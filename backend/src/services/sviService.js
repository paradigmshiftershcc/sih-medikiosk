// Sahaay — deterministic Stress & Vulnerability Index (SVI) engine.
//
// The AI layer only extracts evidence-backed vulnerability signals. This
// service computes the index from those signals with fixed weights so the
// result is transparent, reproducible, and NEVER chosen by an LLM.
//
// Weights (SIH26093 requirement):
//   immediate danger                +30
//   direct/repeated threats         +20
//   severe fear / distress          +15 (either signal, counted once)
//   intimidation / coercion         +10
//   social isolation / no support   +10 (either signal, counted once)
//   displacement / homelessness     +10
//   self-harm / suicidal statement  +35
//   multiple compounding signals    +10 (>= 3 distinct groups)
//
// Explicit self-harm/suicidal statements and immediate danger ALWAYS force
// at least CRITICAL handling regardless of the numeric score.

// Each group contributes its weight at most once, avoiding double-counting
// closely related signals (e.g. severeFear + severeDistress).
const SVI_GROUPS = [
  {
    key: "immediateDanger",
    signals: ["immediateDanger"],
    weight: 30,
    label: "Immediate danger reported",
  },
  {
    key: "reportedThreats",
    signals: ["reportedThreats"],
    weight: 20,
    label: "Direct or repeated threats",
  },
  {
    key: "severeFearOrDistress",
    signals: ["severeFear", "severeDistress"],
    weight: 15,
    label: "Severe fear / distress",
  },
  {
    key: "intimidation",
    signals: ["intimidation"],
    weight: 10,
    label: "Intimidation or coercion",
  },
  {
    key: "socialIsolationOrNoSupport",
    signals: ["socialIsolation", "supportNetworkUnavailable"],
    weight: 10,
    label: "Social isolation / no support network",
  },
  {
    key: "displacement",
    signals: ["displacement"],
    weight: 10,
    label: "Displacement / homelessness",
  },
  {
    key: "selfHarmStatement",
    signals: ["selfHarmStatement"],
    weight: 35,
    label: "Self-harm or suicidal statement",
  },
  {
    key: "medicalConcern",
    signals: ["medicalConcern"],
    weight: 5,
    label: "Medical concern reported",
  },
];

const COMPOUNDING_THRESHOLD = 3;
const COMPOUNDING_WEIGHT = 10;
const CRITICAL_MIN_SCORE = 75;
const MAX_SCORE = 100;

// Assessment engine version stamped on every SVI output so scores are
// reproducible and auditable by human reviewers.
export const SVI_ENGINE_VERSION = "svi-prototype-v1";

export const PROTOTYPE_DISCLAIMER =
  "Prototype vulnerability triage index — not a clinical diagnosis or legally validated risk instrument.";

// 0-24 LOW, 25-49 MODERATE, 50-74 HIGH, 75-100 CRITICAL.
export const classifyRiskLevel = (score) => {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
};

// Human-readable officer-facing safety indicators from detected signals.
const SAFETY_INDICATORS = [
  { signal: "immediateDanger", label: "Immediate danger reported" },
  { signal: "selfHarmStatement", label: "Self-harm / suicidal statement" },
  { signal: "reportedThreats", label: "Threats reported" },
  { signal: "severeFear", label: "Severe fear" },
  { signal: "severeDistress", label: "Severe distress" },
  { signal: "intimidation", label: "Intimidation / coercion" },
  { signal: "socialIsolation", label: "Social isolation" },
  { signal: "supportNetworkUnavailable", label: "No support network" },
  { signal: "displacement", label: "Displacement / homelessness" },
  { signal: "medicalConcern", label: "Medical concern" },
];

export const toSafetyIndicators = (signals = {}) =>
  SAFETY_INDICATORS.filter(({ signal }) => Boolean(signals[signal])).map(
    ({ label }) => label,
  );

export const computeSvi = (signals = {}, evidence = []) => {
  const evidenceBySignal = {};
  (evidence || []).forEach((item) => {
    if (item?.signal && item?.evidence) {
      evidenceBySignal[item.signal] = item.evidence;
    }
  });

  let score = 0;
  const factors = [];

  SVI_GROUPS.forEach((group) => {
    const matched = group.signals.filter(
      (signal) => Boolean(signals?.[signal]) === true,
    );
    if (matched.length === 0) return;
    score += group.weight;
    const evidenceText = matched
      .map((signal) => evidenceBySignal[signal])
      .filter(Boolean)
      .join(" ");
    factors.push({
      signal: group.key,
      // Explainability aliases: UPPER_SNAKE factor id, numeric points, and
      // provenance. source is SELF_REPORT for evidence-backed disclosures.
      factor: group.key.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase(),
      label: group.label,
      weight: group.weight,
      points: group.weight,
      source: "SELF_REPORT",
      evidence: evidenceText,
    });
  });

  if (factors.length >= COMPOUNDING_THRESHOLD) {
    score += COMPOUNDING_WEIGHT;
    factors.push({
      signal: "compounding",
      factor: "COMPOUNDING",
      label: "Multiple compounding signals",
      weight: COMPOUNDING_WEIGHT,
      points: COMPOUNDING_WEIGHT,
      source: "ENGINE",
      evidence: `${factors.length} distinct vulnerability groups detected`,
    });
  }

  // Deterministic escalation override: explicit self-harm/suicidal statement
  // or immediate danger forces at least CRITICAL handling.
  const forcedCritical =
    Boolean(signals?.selfHarmStatement) || Boolean(signals?.immediateDanger);
  score = Math.max(0, Math.min(MAX_SCORE, score));
  if (forcedCritical && score < CRITICAL_MIN_SCORE) {
    score = CRITICAL_MIN_SCORE;
  }

  return {
    score,
    riskLevel: classifyRiskLevel(score),
    band: classifyRiskLevel(score),
    factors,
    disclaimer: PROTOTYPE_DISCLAIMER,
    computedAt: new Date(),
    forcedCritical,
    engineVersion: SVI_ENGINE_VERSION,
  };
};