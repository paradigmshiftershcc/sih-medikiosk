import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateVoiceFeatures,
  interpretVoiceFeatures,
  VOICE_OBSERVATION_DISCLAIMER,
} from "../src/services/voiceAnalyticsService.js";
import {
  extractUrgentSignalsFromText,
  mergePerTurnSignals,
  buildModelChain,
  KNOWN_GEMINI_MODELS,
} from "../src/services/traumaAssessmentService.js";
import { computeSvi } from "../src/services/sviService.js";
import {
  buildRecommendations,
  GOVERNMENT_REFERRALS,
} from "../src/services/supportRecommendationService.js";
import { compareQueuePriority, buildQueueFilter } from "../src/controllers/supportCaseController.js";
import { computeVoiceFeatures } from "../../frontend/src/lib/voiceAnalytics.js";

const BASE_FEATURES = {
  durationMs: 8000,
  speechRatio: 0.6,
  silenceRatio: 0.4,
  pauseCount: 4,
  meanPauseMs: 500,
  longPauseCount: 0,
  rmsMean: 0.2,
  rmsVariation: 0.1,
  pitchMeanHz: 180,
  pitchStdHz: 25,
  pitchRangeHz: 90,
  speechRateProxy: 2.5,
  spectralCentroidMeanHz: 1400,
};

// ---- validation ----

test("voice features: valid object passes validation", () => {
  const { valid, errors, features } = validateVoiceFeatures(BASE_FEATURES);
  assert.equal(valid, true);
  assert.equal(errors.length, 0);
  assert.equal(features.speechRatio, 0.6);
});

test("voice features: out-of-range values rejected", () => {
  const { valid, errors, features } = validateVoiceFeatures({
    ...BASE_FEATURES,
    speechRatio: 1.5,
    pauseCount: -2,
  });
  assert.equal(valid, false);
  assert.ok(errors.length >= 2);
  assert.equal(features, null);
});

test("voice features: clip too short rejected", () => {
  const { valid } = validateVoiceFeatures({ ...BASE_FEATURES, durationMs: 250 });
  assert.equal(valid, false);
});

test("voice features: null pitch allowed (whisper/quiet speech)", () => {
  const { valid, features } = validateVoiceFeatures({
    ...BASE_FEATURES,
    pitchMeanHz: null,
    pitchStdHz: null,
    pitchRangeHz: null,
  });
  assert.equal(valid, true);
  assert.equal(features.pitchMeanHz, null);
});

// ---- interpretation ----

test("voice interpretation: silence-only clip -> insufficient speech only", () => {
  const obs = interpretVoiceFeatures({ ...BASE_FEATURES, speechRatio: 0.02, silenceRatio: 0.98 });
  assert.equal(obs.length, 1);
  assert.equal(obs[0].type, "INSUFFICIENT_SPEECH");
  assert.equal(obs[0].source, "VOICE_ANALYTICS");
});

test("voice interpretation: repeated long pauses flagged", () => {
  const obs = interpretVoiceFeatures({ ...BASE_FEATURES, longPauseCount: 3 });
  const found = obs.find((o) => o.type === "LONG_PAUSES");
  assert.ok(found);
  assert.equal(found.severity, "MODERATE");
  assert.match(found.evidence, /long pauses/i);
});

test("voice interpretation: very high pause ratio escalates", () => {
  const obs = interpretVoiceFeatures({
    ...BASE_FEATURES,
    speechRatio: 0.2,
    silenceRatio: 0.8,
  });
  const found = obs.find((o) => o.type === "HIGH_PAUSE_RATIO");
  assert.ok(found);
  assert.equal(found.severity, "HIGH");
});

test("voice interpretation: elevated pitch variation flagged, never diagnostic", () => {
  const obs = interpretVoiceFeatures({
    ...BASE_FEATURES,
    pitchMeanHz: 200,
    pitchStdHz: 90,
    pitchRangeHz: 300,
  });
  const found = obs.find((o) => o.type === "PITCH_VARIATION_ELEVATED");
  assert.ok(found);
  for (const o of obs) {
    assert.doesNotMatch(`${o.type} ${o.evidence}`, /depress|ptsd|suicid|diagnos/i);
  }
});

test("voice interpretation: missing pitch noted, low energy variation flagged", () => {
  const obs = interpretVoiceFeatures({
    ...BASE_FEATURES,
    pitchMeanHz: null,
    pitchStdHz: null,
    pitchRangeHz: null,
    rmsMean: 0.2,
    rmsVariation: 0.02,
  });
  assert.ok(obs.find((o) => o.type === "NO_PITCH_DETECTED"));
  assert.ok(obs.find((o) => o.type === "LOW_ENERGY_VARIATION"));
});

test("voice interpretation: rapid and slow speech proxies", () => {
  const rapid = interpretVoiceFeatures({ ...BASE_FEATURES, speechRateProxy: 8 });
  assert.ok(rapid.find((o) => o.type === "RAPID_SPEECH_PROXY"));
  const slow = interpretVoiceFeatures({ ...BASE_FEATURES, speechRateProxy: 0.8 });
  assert.ok(slow.find((o) => o.type === "SLOW_SPEECH_PROXY"));
});

test("voice disclaimer labels indicators as supporting, not diagnostic", () => {
  assert.match(VOICE_OBSERVATION_DISCLAIMER, /not a clinical diagnosis/i);
});

// ---- per-turn deterministic extraction ----

test("per-turn: immediate danger caught with quoted evidence", () => {
  const { signals, evidence } = extractUrgentSignalsFromText(
    "He is here right now with a weapon, threatening to kill me. Please help.",
  );
  assert.equal(signals.immediateDanger, true);
  assert.ok(evidence.find((e) => e.signal === "immediateDanger"));
  assert.match(evidence[0].evidence, /weapon/i);
});

test("per-turn: self-harm statement caught, benign text clean", () => {
  const hit = extractUrgentSignalsFromText("Sometimes I feel like ending it all.");
  assert.equal(hit.signals.selfHarmStatement, true);
  const clean = extractUrgentSignalsFromText(
    "I want to know which office to approach for my land record.",
  );
  assert.equal(clean.signals.immediateDanger, false);
  assert.equal(clean.signals.selfHarmStatement, false);
  assert.equal(clean.signals.reportedThreats, false);
  assert.equal(clean.evidence.length, 0);
});

test("per-turn: explicit threats caught; unknown stays unset", () => {
  const { signals } = extractUrgentSignalsFromText(
    "He keeps threatening to kill my family if we complain.",
  );
  assert.equal(signals.reportedThreats, true);
  assert.equal(signals.immediateDanger, false);
});

test("per-turn merge is monotonic and reports new signals", () => {
  const { merged, newSignals } = mergePerTurnSignals(
    { reportedThreats: true },
    { immediateDanger: true, selfHarmStatement: false, reportedThreats: true },
  );
  assert.equal(merged.immediateDanger, true);
  assert.equal(merged.reportedThreats, true);
  assert.deepEqual(newSignals, ["immediateDanger"]);
});

// ---- explainability ----

test("SVI explainability: engine version, factor points, provenance", () => {
  const svi = computeSvi({ reportedThreats: true, severeFear: true }, []);
  assert.equal(svi.engineVersion, "svi-prototype-v1");
  assert.equal(svi.band, svi.riskLevel);
  for (const f of svi.factors) {
    assert.ok(f.factor);
    assert.equal(f.points, f.weight);
    assert.equal(f.source, "SELF_REPORT");
  }
});

test("SVI explainability: factor points sum to score (non-forced)", () => {
  const svi = computeSvi(
    {
      displacement: true,
      socialIsolation: true,
      severeDistress: true,
      reportedThreats: true,
    },
    [],
  );
  const total = svi.factors.reduce((sum, f) => sum + f.points, 0);
  assert.equal(total, svi.score);
  const compounding = svi.factors.find((f) => f.factor === "COMPOUNDING");
  assert.ok(compounding);
  assert.equal(compounding.source, "ENGINE");
});

// ---- recommendations v2 ----

test("recommendations: protection review on threats", () => {
  const { recommendations } = buildRecommendations({ reportedThreats: true });
  const protection = recommendations.find((r) => r.code === "PROTECTION_REVIEW");
  assert.ok(protection);
  assert.match(protection.reason, /protection/i);
  assert.equal(protection.humanReviewRequired, true);
});

test("recommendations: immediate danger -> emergency + escalation first", () => {
  const { recommendations } = buildRecommendations({ immediateDanger: true });
  const codes = recommendations.map((r) => r.code);
  assert.ok(codes.includes("EMERGENCY_SUPPORT"));
  assert.ok(codes.includes("HUMAN_ESCALATION"));
  assert.ok(recommendations[0].priority === 1);
  for (const r of recommendations) {
    assert.equal(r.humanReviewRequired, true);
    assert.ok(r.reason);
  }
});

test("recommendations: trigger evidence wired, dedupe by code", () => {
  const evidence = [
    { signal: "reportedThreats", evidence: "He said he will burn my house." },
  ];
  const { recommendations } = buildRecommendations(
    { reportedThreats: true, legalAssistanceRequested: true },
    evidence,
  );
  assert.equal(recommendations.filter((r) => r.code === "LEGAL_AID").length, 1);
  const legal = recommendations.find((r) => r.code === "LEGAL_AID");
  assert.ok(legal.triggerEvidence.includes("He said he will burn my house."));
});

test("government referrals list verified helplines as external only", () => {
  const numbers = Object.fromEntries(GOVERNMENT_REFERRALS.map((r) => [r.name, r.number]));
  const joined = JSON.stringify(numbers);
  assert.ok(joined.includes("14566"));
  assert.ok(joined.includes("112"));
  assert.ok(joined.includes("14416"));
  assert.ok(joined.includes("15100"));
  for (const r of GOVERNMENT_REFERRALS) {
    assert.equal(r.type, "EXTERNAL_REFERRAL");
  }
});

// ---- queue priority ----

test("queue priority: critical > danger > self-harm > high > newest", () => {
  const mk = (over) => ({
    svi: { riskLevel: "HIGH" },
    immediateDanger: false,
    selfHarm: false,
    submittedAt: new Date("2026-09-01T10:00:00Z"),
    ...over,
  });
  const critical = mk({ svi: { riskLevel: "CRITICAL" }, submittedAt: new Date("2026-08-01T10:00:00Z") });
  const danger = mk({ submittedAt: new Date("2026-08-01T10:00:00Z"), immediateDanger: true });
  const harm = mk({ submittedAt: new Date("2026-08-01T10:00:00Z"), selfHarm: true });
  const highOld = mk({});
  const highNew = mk({ submittedAt: new Date("2026-09-02T10:00:00Z") });
  const sorted = [highOld, harm, highNew, danger, critical].sort(compareQueuePriority);
  assert.deepEqual(sorted, [critical, danger, harm, highNew, highOld]);
});

// ---- model chain ----

test("model chain: verified baseline, invented ids rejected", () => {
  const chain = buildModelChain();
  assert.equal(chain[0], "gemini-3.6-flash");
  assert.ok(chain.includes("gemini-3.7-flash"));
  assert.ok(chain.includes("gemini-3.8-flash"));
  assert.ok(chain.includes("gemini-3.5-flash-lite"));
  for (const id of chain) {
    assert.ok(KNOWN_GEMINI_MODELS.has(id), `unexpected model ${id}`);
  }
  assert.ok(!KNOWN_GEMINI_MODELS.has("gemini-3.6-flash-lite"));
});

test("queue filter: default scope is active queue, scope=all returns all submitted", () => {
  assert.deepEqual(buildQueueFilter(undefined), {
    submittedAt: { $ne: null },
    status: { $in: ["NEW", "IN_REVIEW", "ESCALATED", "ASSIGNED"] },
  });
  assert.deepEqual(buildQueueFilter("all"), { submittedAt: { $ne: null } });
});

test("model chain: GEMINI_MODEL env respected when valid", () => {
  process.env.GEMINI_MODEL = "gemini-3.7-flash";
  try {
    const chain = buildModelChain();
    assert.equal(chain[0], "gemini-3.7-flash");
  } finally {
    delete process.env.GEMINI_MODEL;
  }
});

// ---- client feature math (pure, no browser APIs) ----

const sineWithGaps = (sampleRate = 16000) => {
  // 4s: 1s 200Hz tone, 1.2s silence, 1s tone, 0.8s silence.
  const total = sampleRate * 4;
  const mono = new Float32Array(total);
  const tone = (from, to) => {
    for (let i = from; i < to; i++) {
      mono[i] = 0.5 * Math.sin((2 * Math.PI * 200 * i) / sampleRate);
    }
  };
  tone(0, sampleRate * 1);
  tone(Math.floor(sampleRate * 2.2), Math.floor(sampleRate * 3.2));
  return mono;
};

test("voice features: silence-only clip has no speech and null pitch", () => {
  const mono = new Float32Array(16000 * 2);
  const f = computeVoiceFeatures(mono, 16000);
  assert.ok(f);
  assert.equal(f.speechRatio, 0);
  assert.equal(f.pitchMeanHz, null);
  assert.equal(f.durationMs, 2000);
});

test("voice features: tone with gaps yields pitch and long pauses", () => {
  const f = computeVoiceFeatures(sineWithGaps(), 16000);
  assert.ok(f);
  assert.ok(f.pitchMeanHz >= 180 && f.pitchMeanHz <= 220, `pitch ${f.pitchMeanHz}`);
  assert.equal(f.longPauseCount, 1);
  assert.ok(f.pauseCount >= 2);
  assert.ok(f.speechRatio > 0.3 && f.speechRatio < 0.7);
});

test("voice features: empty and tiny clips rejected", () => {
  assert.equal(computeVoiceFeatures(new Float32Array(0), 16000), null);
  assert.equal(computeVoiceFeatures(new Float32Array(100), 16000), null);
  assert.equal(computeVoiceFeatures(null, 16000), null);
});
