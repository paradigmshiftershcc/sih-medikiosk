import { GoogleGenAI } from "@google/genai";

// Sahaay — trauma-informed support assistant and evidence-backed signal
// extraction layer (SIH26093).
//
// The LLM NEVER computes a stress/trauma score. It only (a) conducts a gentle,
// one-question-at-a-time conversation and (b) extracts evidence-backed
// vulnerability signals. The deterministic SVI engine in sviService.js
// derives the score and risk band from those signals.

// Model chain: GEMINI_MODEL is the primary; GEMINI_MODEL_FALLBACKS is a
// comma-separated fallback list. Every id is validated against the verified
// Gemini catalog — invented ids are rejected with a warning, never called.
export const KNOWN_GEMINI_MODELS = new Set([
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
]);

const DEFAULT_PRIMARY = "gemini-3.6-flash";
// Wider hedged fallback set (all GA, verified 2026-09-22): newer Flash
// models first, latency-optimized Lite last.
const DEFAULT_FALLBACKS = [
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
];

export const buildModelChain = () => {
  const primary =
    process.env.GEMINI_MODEL ||
    process.env.GEMINI_MODEL_PRIMARY ||
    DEFAULT_PRIMARY;
  const fallbackRaw =
    process.env.GEMINI_MODEL_FALLBACKS ||
    process.env.GEMINI_MODEL_FALLBACK ||
    DEFAULT_FALLBACKS.join(",");
  const chain = [];
  for (const id of [primary, ...fallbackRaw.split(",")]) {
    const model = (id || "").trim();
    if (!model || chain.includes(model)) continue;
    if (!KNOWN_GEMINI_MODELS.has(model)) {
      console.warn(
        `[Gemini API] Unknown model id "${model}" rejected (not in verified catalog).`,
      );
      continue;
    }
    chain.push(model);
  }
  return chain;
};

// Tunable failover budget. Hedging (below) means the typical case resolves
// in ~hedge-delay + response time instead of timeout × models.
const CHAT_TIMEOUT_MS = Number(process.env.GEMINI_CHAT_TIMEOUT_MS || 8000);
const ASSESS_TIMEOUT_MS = Number(process.env.GEMINI_ASSESS_TIMEOUT_MS || 20000);
const AFFECT_TIMEOUT_MS = Number(process.env.GEMINI_AFFECT_TIMEOUT_MS || 15000);
const HEDGE_DELAY_MS = Number(process.env.GEMINI_HEDGE_DELAY_MS || 2000);
const MODEL_COOLDOWN_MS = Number(process.env.GEMINI_MODEL_COOLDOWN_MS || 30000);

const modelHealth = {};

const healthFor = (model) => {
  if (!modelHealth[model]) {
    modelHealth[model] = { failureCount: 0, cooldownUntil: 0 };
  }
  return modelHealth[model];
};

const isModelInCooldown = (model) =>
  Date.now() < healthFor(model).cooldownUntil;

const markModelFailure = (model) => {
  const health = healthFor(model);
  health.failureCount += 1;
  if (health.failureCount >= 2) {
    health.cooldownUntil = Date.now() + MODEL_COOLDOWN_MS;
    console.warn(
      `[Gemini API] Model ${model} entering cooldown due to repeated failures.`,
    );
  }
};

const resetModelHealth = (model) => {
  const health = healthFor(model);
  health.failureCount = 0;
  health.cooldownUntil = 0;
};

const parseJsonResponse = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("EMPTY_AI_RESPONSE");
  }
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(cleaned);
};

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

// Hedged execution across the model chain: the first model starts
// immediately, the rest start staggered by HEDGE_DELAY_MS. The first
// FULLY SUCCESSFUL attempt (API call + JSON parse) wins; genuine errors
// fail over without waiting for stragglers. A model that merely loses the
// race is NOT penalized — only models that error before any success count
// toward cooldown. Resolves { model, result } or throws when all fail.
const callGeminiHedged = ({ label, contents, config, timeoutMs, parse }) =>
  new Promise((resolve, reject) => {
    const chain = buildModelChain();
    if (chain.length === 0) {
      reject(new Error("NO_MODELS_AVAILABLE"));
      return;
    }
    const fresh = chain.filter((m) => !isModelInCooldown(m));
    // Cooldown is advisory: if everything is cooling down, still try the
    // chain rather than failing instantly into deterministic fallback.
    const models = fresh.length ? fresh : chain;
    if (!fresh.length) {
      console.warn(
        `[Gemini API] All models in cooldown; retrying chain anyway for ${label}.`,
      );
    }

    let settled = false;
    let failures = 0;
    const errors = [];
    const timers = [];
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      timers.forEach(clearTimeout);
      fn();
    };

    models.forEach((model, index) => {
      timers.push(
        setTimeout(async () => {
          if (settled) return;
          try {
            console.log(
              `[Gemini API] ${label} using ${model}${index > 0 ? " (hedged)" : ""}.`,
            );
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const response = await withTimeout(
              ai.models.generateContent({ model, contents, config }),
              timeoutMs,
            );
            const parsed = parse(response.text);
            resetModelHealth(model);
            finish(() => resolve({ model, result: parsed }));
          } catch (error) {
            if (settled) return; // lost the race; not a failure
            console.error(
              `[Gemini API] ${label} error on ${model}: ${error?.message || error}`,
            );
            markModelFailure(model);
            failures += 1;
            errors.push(`${model}: ${error?.message || error}`);
            if (failures >= models.length) {
              finish(() => reject(new Error(errors.join(" | "))));
            }
          }
        }, index * HEDGE_DELAY_MS),
      );
    });
  });

// ---------------------------------------------------------------------------
// Deterministic urgent-hint scan (complements, never replaces, the AI layer).
// Guards the "Your immediate safety may be at risk" banner even if the model
// call fails or a provider is unavailable.
// ---------------------------------------------------------------------------
const DANGER_HINT_PATTERN =
  /\b(kill|killed|murder|sucide|suicid|end my life|end it all|do away with myself|take my own life|want to (die|end)|can't take it anymore|about to (kill|hurt|beat|attack)|going to (kill|hurt|beat)|threaten(?:ing|ed)? (?:to )?(?:kill|attack|beat|hurt)|has a weapon|right now|right here|attack(?:ed)? me|beat me|hurt me|afraid for my (?:life|safety)|in danger|kidnap|rape(?:d)? me|harass(?:ed|ing)? me)\b/i;

export const scanUrgentHints = (transcript = []) => {
  const fullText = (transcript || [])
    .map((message) => message.content || "")
    .join(" ");
  return DANGER_HINT_PATTERN.test(fullText);
};

// ---------------------------------------------------------------------------
// Conversation: ONE short, warm, plain-language question per turn.
// ---------------------------------------------------------------------------
const CHAT_SCHEMA = {
  type: "object",
  properties: {
    response: {
      type: "string",
      description:
        "Exactly one short, warm, plain-language question or a brief supportive message. In an acute danger situation the exact string 'Your immediate safety may be at risk. This case requires urgent human review.' must appear.",
    },
    isComplete: {
      type: "boolean",
      description:
        "Whether the complainant has shared enough to route support, or says they are done.",
    },
    immediateDangerMentioned: {
      type: "boolean",
      description:
        "True only when the complainant explicitly says they are in danger RIGHT NOW or mentions self-harm or suicide.",
    },
  },
  required: ["response", "isComplete", "immediateDangerMentioned"],
};

export const generateSupportQuestion = async (transcript = [], options = {}) => {
  const { language = "en" } = options;

  const formattedContents = (transcript || []).map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));
  // Gemini requires the first content turn from the user; if the transcript is
  // empty we seed the assistant's opening line ourselves in the controller.
  if (formattedContents.length === 0) {
    formattedContents.push({ role: "user", parts: [{ text: "(the complainant is ready to begin)" }] });
  }

  const languageHint =
    language === "auto"
      ? "Respond in the language the complainant is using."
      : `Respond in ${language}.`;

  const systemInstruction = `
You are Sahaay, the AI support assistant inside an online stress and trauma
assessment module for victims and complainants accessing the National Helpline
against Atrocity (NHAA - 14566) and its integrated portal.

You help a complainant share what happened, ASKING EXACTLY ONE SHORT QUESTION
PER TURN in plain, warm language. You are NOT a doctor, lawyer, or police
officer. You do NOT diagnose or treat mental-health conditions, you do NOT
decide guilt, blame, or credibility, and you do NOT record a legal statement.

QUESTIONING RULES:
1. Exactly ONE short, warm, plain-language question per turn.
2. Read the entire transcript before responding; never ask a question already answered.
3. Do not press for traumatic detail. Ask broad, gentle questions such as
   "What would you like to start with?" or "Is there anything else you are
   comfortable sharing?" Do NOT interrogate.
4. Never ask the complainant to repeat details that already upset them.
5. If the complainant says they are in danger RIGHT NOW, or mentions
   self-harm or suicide, STOP normal questioning and make your response contain
   the exact string "Your immediate safety may be at risk. This case requires urgent human review."
6. Never promise specific outcomes, legal success, anonymity, or confidentiality.
7. Never give legal conclusions, medical advice, or instructions to confront anyone.
8. Keep vocabulary simple and age-appropriate; assume a low-literacy context.

${languageHint}

Return ONLY the requested JSON structure.
`;

  const config = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: CHAT_SCHEMA,
    thinkingConfig: { thinkingLevel: "low" },
  };

  try {
    const { model, result } = await callGeminiHedged({
      label: "Support question",
      contents: formattedContents,
      config,
      timeoutMs: CHAT_TIMEOUT_MS,
      parse: parseJsonResponse,
    });
    return {
      response: result.response,
      isComplete: Boolean(result.isComplete),
      immediateDangerMentioned: Boolean(result.immediateDangerMentioned),
      provider: model,
    };
  } catch (error) {
    console.error(`[Gemini API] Support chat exhausted chain: ${error?.message || error}`);
  }

  // Graceful fallback: deterministic urgent hint only — never fabricate a score.
  const urgent = scanUrgentHints(transcript);
  return {
    response: urgent
      ? "Your immediate safety may be at risk. This case requires urgent human review."
      : "I am here. Please share what you are comfortable with, in your own words.",
    isComplete: false,
    immediateDangerMentioned: urgent,
    provider: "deterministic-fallback",
  };
};

// ---------------------------------------------------------------------------
// Per-turn deterministic urgent-signal extraction (no AI call).
// Runs on the LATEST user message after every chat turn so the SVI evolves
// in real time. Only high-confidence explicit statements are captured;
// anything ambiguous stays unset for the full Gemini extraction.
// ---------------------------------------------------------------------------
const PER_TURN_PATTERNS = [
  {
    signal: "immediateDanger",
    pattern:
      /\b(with a (weapon|gun|knife)|has a (weapon|gun|knife)|here right now|right here|right now.{0,60}(kill|hurt|attack|beat|danger)|going to (kill|hurt|attack)|about to (kill|hurt|attack|beat)|(is |are )?(attacking|beating|hurting) me|breaking in|trying to (kill|hurt|break in)|in danger right now)\b/i,
  },
  {
    signal: "selfHarmStatement",
    pattern:
      /\b(kill my ?self|end(ing)? (my life|it all)|take my own life|want to (die|end)|suicid\w*|do away with myself|no reason to live|better off dead)\b/i,
  },
  {
    signal: "reportedThreats",
    pattern:
      /\b(threaten\w*(\s+to)?\s+(kill|hurt|beat|burn|attack)|will (kill|burn|hurt|beat) (me|my|us)|threatening to kill)\b/i,
  },
];

const quoteSentence = (text, matchIndex, matchLength) => {
  const start = Math.max(0, text.lastIndexOf(".", matchIndex) + 1);
  let end = text.indexOf(".", matchIndex + matchLength);
  if (end === -1) end = text.length;
  const quote = text.slice(start, end).trim().replace(/\s+/g, " ");
  return quote.length > 220 ? `${quote.slice(0, 220)}…` : quote;
};

export const extractUrgentSignalsFromText = (text = "") => {
  const signals = { immediateDanger: false, selfHarmStatement: false, reportedThreats: false };
  const evidence = [];
  if (!text || typeof text !== "string") return { signals, evidence };
  for (const { signal, pattern } of PER_TURN_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      signals[signal] = true;
      evidence.push({
        signal,
        evidence: quoteSentence(text, match.index, match[0].length),
      });
    }
  }
  return { signals, evidence };
};

// Merge per-turn urgent signals into the accumulated case signals.
// Monotonic for urgent flags (never cleared by later turns); returns the
// list of newly-true signals for the assessment timeline.
export const mergePerTurnSignals = (existing = {}, perTurn = {}) => {
  const merged = { ...(existing || {}) };
  const newSignals = [];
  for (const key of ["immediateDanger", "selfHarmStatement", "reportedThreats"]) {
    if (perTurn?.[key] && !merged[key]) {
      merged[key] = true;
      newSignals.push(key);
    }
  }
  return { merged, newSignals };
};

// ---------------------------------------------------------------------------
// Assessment: extract evidence-backed vulnerability signals (no scoring).
// ---------------------------------------------------------------------------
const SIGNALS_SCHEMA = {
  type: "object",
  properties: {
    incidentSummary: {
      type: "string",
      description:
        "One or two sentences summarizing what the complainant reported, using only supported information.",
    },
    category: {
      type: "string",
      description:
        "Plain-language category of the concern (e.g. domestic, threat, employment, property, harassment, unspecified). Use 'unspecified' unless clearly supported.",
    },
    signals: {
      type: "object",
      description:
        "Evidence-backed vulnerability signals. Mark true ONLY when the complainant's own words support it.",
      properties: {
        immediateDanger: { type: "boolean" },
        reportedThreats: { type: "boolean" },
        severeFear: { type: "boolean" },
        severeDistress: { type: "boolean" },
        intimidation: { type: "boolean" },
        socialIsolation: { type: "boolean" },
        supportNetworkUnavailable: { type: "boolean" },
        displacement: { type: "boolean" },
        selfHarmStatement: { type: "boolean" },
        medicalConcern: { type: "boolean" },
        legalAssistanceRequested: { type: "boolean" },
      },
      required: [],
    },
    evidence: {
      type: "array",
      description:
        "One entry per true signal, quoting the exact words or a faithful paraphrase from the transcript.",
      items: {
        type: "object",
        properties: {
          signal: { type: "string" },
          evidence: { type: "string" },
        },
        required: ["signal", "evidence"],
      },
    },
    needsImmediateHumanReview: {
      type: "boolean",
      description:
        "True when the transcript contains an explicit immediate-danger or self-harm/suicidal statement.",
    },
    missingInformation: {
      type: "array",
      items: { type: "string" },
      description: "Important context that was not provided by the complainant.",
    },
    incidentType: {
      type: "string",
      description:
        "Best-fit incident class. Use UNKNOWN unless clearly supported by the complainant's own words.",
      enum: [
        "CASTE_DISCRIMINATION",
        "PHYSICAL_VIOLENCE",
        "SEXUAL_VIOLENCE",
        "THREAT_INTIMIDATION",
        "SOCIAL_BOYCOTT",
        "DISPLACEMENT",
        "FAMILY_DEATH",
        "LEGAL_PROCEEDING_DISTRESS",
        "OTHER",
        "UNKNOWN",
      ],
    },
    immediateSafety: {
      type: "string",
      description:
        "Whether the complainant states they are currently safe. UNSAFE only for explicit present danger; otherwise UNKNOWN. Never SAFE unless stated.",
      enum: ["SAFE", "UNSAFE", "UNKNOWN"],
    },
    supportNeeds: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "COUNSELLING",
          "LEGAL_AID",
          "MEDICAL",
          "POLICE_REVIEW",
          "PROTECTION_REVIEW",
          "SHELTER_REHABILITATION",
          "EMERGENCY_SUPPORT",
          "HUMAN_REVIEW",
        ],
      },
      description:
        "Support needs explicitly expressed or clearly implied by the complainant. Empty when unknown.",
    },
    signalConfidence: {
      type: "object",
      description:
        "Confidence 0-1 for each true signal, based on how explicitly the transcript supports it.",
    },
  },
  required: [
    "incidentSummary",
    "category",
    "signals",
    "evidence",
    "needsImmediateHumanReview",
    "missingInformation",
    "incidentType",
    "immediateSafety",
    "supportNeeds",
    "signalConfidence",
  ],
};

const SIGNAL_KEYS = [
  "immediateDanger",
  "reportedThreats",
  "severeFear",
  "severeDistress",
  "intimidation",
  "socialIsolation",
  "supportNetworkUnavailable",
  "displacement",
  "selfHarmStatement",
  "medicalConcern",
  "legalAssistanceRequested",
];

export const extractVulnerabilitySignals = async (transcript = []) => {
  const promptContent = `
COMPLAINANT TRANSCRIPT:
${JSON.stringify(transcript || [])}

TASK:
Read the transcript. Extract the vulnerability signals that are EXPLICITLY
supported by the complainant's own words.

STRICT RULES:
1. Never infer a signal from typing style, grammar, vocabulary, accent, or any
   demographic trait (gender, caste, religion, region, income).
2. Never invent facts. Quote evidence verbatim or faithfully paraphrase it.
3. Mark a signal false unless the transcript clearly supports it.
4. If the complainant mentioned possible harm (e.g. hurting themselves, being in
   danger right now), set the matching signal and needsImmediateHumanReview.
5. Do NOT produce a score, a diagnosis, a legal opinion, or a treatment plan.
6. Return ONLY the requested JSON structure.
`;

  const config = {
    systemInstruction:
      "You are the evidence-extraction stage of an AI-assisted stress and trauma triage prototype. You extract only what the complainant explicitly stated. You never score, diagnose, judge credibility, or advise.",
    responseMimeType: "application/json",
    responseSchema: SIGNALS_SCHEMA,
    thinkingConfig: { thinkingLevel: "low" },
  };

  const VALID_INCIDENT_TYPES = new Set([
    "CASTE_DISCRIMINATION",
    "PHYSICAL_VIOLENCE",
    "SEXUAL_VIOLENCE",
    "THREAT_INTIMIDATION",
    "SOCIAL_BOYCOTT",
    "DISPLACEMENT",
    "FAMILY_DEATH",
    "LEGAL_PROCEEDING_DISTRESS",
    "OTHER",
    "UNKNOWN",
  ]);
  const VALID_SAFETY = new Set(["SAFE", "UNSAFE", "UNKNOWN"]);
  const VALID_SUPPORT = new Set([
    "COUNSELLING",
    "LEGAL_AID",
    "MEDICAL",
    "POLICE_REVIEW",
    "PROTECTION_REVIEW",
    "SHELTER_REHABILITATION",
    "EMERGENCY_SUPPORT",
    "HUMAN_REVIEW",
  ]);

  try {
    const { model, result } = await callGeminiHedged({
      label: "Signal extraction",
      contents: promptContent,
      config,
      timeoutMs: ASSESS_TIMEOUT_MS,
      parse: parseJsonResponse,
    });

    const signals = SIGNAL_KEYS.reduce((acc, key) => {
      acc[key] = Boolean(result?.signals?.[key]);
      return acc;
    }, {});

    const evidence = Array.isArray(result?.evidence)
      ? result.evidence.filter((e) => e?.signal && e?.evidence)
      : [];

    const rawType = result?.incidentType;
    const rawSafety = result?.immediateSafety;
    const confidence = {};
    if (result?.signalConfidence && typeof result.signalConfidence === "object") {
      for (const key of SIGNAL_KEYS) {
        const value = Number(result.signalConfidence[key]);
        if (Number.isFinite(value)) {
          confidence[key] = Math.max(0, Math.min(1, value));
        }
      }
    }

    return {
      incidentSummary: result?.incidentSummary || "",
      category: result?.category || "unspecified",
      signals,
      evidence,
      needsImmediateHumanReview: Boolean(
        result?.needsImmediateHumanReview ||
          signals.immediateDanger ||
          signals.selfHarmStatement,
      ),
      missingInformation: Array.isArray(result?.missingInformation)
        ? result.missingInformation
        : [],
      incidentType: VALID_INCIDENT_TYPES.has(rawType) ? rawType : "UNKNOWN",
      immediateSafety: VALID_SAFETY.has(rawSafety) ? rawSafety : "UNKNOWN",
      supportNeeds: Array.isArray(result?.supportNeeds)
        ? [...new Set(result.supportNeeds.filter((n) => VALID_SUPPORT.has(n)))]
        : [],
      signalConfidence: confidence,
      provider: model,
    };
  } catch (error) {
    console.error(`[Gemini API] Signal extraction exhausted chain: ${error?.message || error}`);
  }

  // Bounded deterministic fallback when Gemini is unavailable: only urgent
  // hints are detected. Other signals stay false. No score is produced here.
  const urgent = scanUrgentHints(transcript);
  const signals = SIGNAL_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});
  signals.immediateDanger = urgent;
  signals.selfHarmStatement =
    /\b(kill my(?:self)?|suicid|end my life|end it all|take my own life|want to (die|end))\b/i.test(
      (transcript || []).map((m) => m.content || "").join(" "),
    );

  const lastUser = [...(transcript || [])].reverse().find((m) => m.role === "user");

  return {
    incidentSummary: lastUser?.content || "",
    category: "unspecified",
    signals,
    evidence: [],
    needsImmediateHumanReview: urgent,
    missingInformation: [],
    incidentType: "UNKNOWN",
    immediateSafety: signals.immediateDanger ? "UNSAFE" : "UNKNOWN",
    supportNeeds: [],
    signalConfidence: {},
    provider: "deterministic-fallback",
    degraded: true,
  };
};

// ---------------------------------------------------------------------------
// OPTIONAL Gemini audio-affect layer (Emotion-AI context only).
// Gated by ENABLE_VOICE_AFFECT_AI=true. Audio is sent IN MEMORY ONLY and is
// never persisted. Returns observable speech characteristics — never a risk
// band, diagnosis, or trauma label. The deterministic SVI engine stays
// authoritative; failures degrade silently to deterministic indicators.
// ---------------------------------------------------------------------------
const AFFECT_LABELS = new Set([
  "HESITATION",
  "STRAINED_SPEECH",
  "RAPID_SPEECH",
  "SLOW_SPEECH",
  "FLAT_DELIVERY",
  "LONG_PAUSES",
  "ELEVATED_VARIABILITY",
]);

const AFFECT_FORBIDDEN = /\b(critical|suicid\w*|depress\w*|trauma\w*|ptsd|diagnos\w*|disorder|risk (band|level|score))\b/i;

export const analyzeVoiceAffect = async ({ audioBase64, mimeType = "audio/wav" } = {}) => {
  if (process.env.ENABLE_VOICE_AFFECT_AI !== "true") {
    return { enabled: false, observations: [] };
  }
  if (!audioBase64 || typeof audioBase64 !== "string" || audioBase64.length > 8_000_000) {
    return { enabled: true, unavailable: true, observations: [] };
  }

  const config = {
    systemInstruction:
      "You describe ONLY directly observable speech characteristics in a short voice clip " +
      "(for example hesitation, strained or tense delivery, unusually rapid or slow speech, " +
      "flat or monotone delivery, repeated long pauses, elevated vocal variability). " +
      "You MUST NOT produce any diagnosis, trauma label, risk band, risk score, or the words " +
      "critical, suicidal, depressed, traumatized, PTSD, diagnosis, or disorder. " +
      "Return ONLY the requested JSON structure.",
    responseMimeType: "application/json",
    responseSchema: {
      type: "object",
      properties: {
        observations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              label: { type: "string" },
              confidence: { type: "number" },
              evidence: { type: "string" },
            },
            required: ["label", "confidence", "evidence"],
          },
        },
      },
      required: ["observations"],
    },
    thinkingConfig: { thinkingLevel: "low" },
  };

  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: audioBase64 } },
        {
          text: "Describe the observable speech characteristics of this voice clip as JSON. Observable characteristics only — not a clinical diagnosis.",
        },
      ],
    },
  ];

  try {
    const { model, result } = await callGeminiHedged({
      label: "Voice affect",
      contents,
      config,
      timeoutMs: AFFECT_TIMEOUT_MS,
      parse: parseJsonResponse,
    });
    const observations = (Array.isArray(result?.observations) ? result.observations : [])
      .filter(
        (o) =>
          o &&
          AFFECT_LABELS.has(String(o.label || "").toUpperCase()) &&
          !AFFECT_FORBIDDEN.test(`${o.label || ""} ${o.evidence || ""}`),
      )
      .map((o) => ({
        label: String(o.label).toUpperCase(),
        confidence: Math.max(0, Math.min(1, Number(o.confidence) || 0.5)),
        evidence: String(o.evidence || "").slice(0, 300),
      }));
    return {
      enabled: true,
      provider: model,
      disclaimer: "Observable speech characteristics, not a clinical diagnosis.",
      observations,
    };
  } catch (error) {
    console.error(`[Gemini API] Voice affect exhausted chain: ${error?.message || error}`);
  }
  return { enabled: true, unavailable: true, observations: [] };
};