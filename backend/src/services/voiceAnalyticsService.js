// Sahaay — deterministic voice/speech indicator interpretation (SIH26093).
//
// The browser extracts compact acoustic features from the already-recorded
// audio Blob (see frontend/src/lib/voiceAnalytics.js). This service
// VALIDATES those features and derives OBSERVATIONS — never diagnoses.
//
// Hard rules:
// - Raw audio is NEVER accepted here (features only) and never persisted.
// - No transcript content is used here.
// - Voice observations NEVER independently set SVI, risk, self-harm, or any
//   psychiatric claim. They are supporting signals for human review.

const num = (value, { min = -Infinity, max = Infinity, integer = false } = {}) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return integer ? Math.round(n) : n;
};

// Validate + normalize a client-computed voice feature object. Returns
// { valid, errors[], features } where features is null when invalid.
export const validateVoiceFeatures = (input = {}) => {
  const errors = [];
  const get = (key, opts, { required = true } = {}) => {
    const value = num(input?.[key], opts);
    if (value === null && required) errors.push(`invalid ${key}`);
    return value;
  };

  const features = {
    durationMs: get("durationMs", { min: 0, max: 300000, integer: true }),
    speechRatio: get("speechRatio", { min: 0, max: 1 }),
    silenceRatio: get("silenceRatio", { min: 0, max: 1 }),
    pauseCount: get("pauseCount", { min: 0, max: 1000, integer: true }),
    meanPauseMs: get("meanPauseMs", { min: 0, max: 60000 }),
    longPauseCount: get("longPauseCount", { min: 0, max: 1000, integer: true }),
    rmsMean: get("rmsMean", { min: 0, max: 2 }),
    rmsVariation: get("rmsVariation", { min: 0, max: 2 }),
    pitchMeanHz: get("pitchMeanHz", { min: 40, max: 1000 }, { required: false }),
    pitchStdHz: get("pitchStdHz", { min: 0, max: 500 }, { required: false }),
    pitchRangeHz: get("pitchRangeHz", { min: 0, max: 960 }, { required: false }),
    speechRateProxy: get("speechRateProxy", { min: 0, max: 60 }),
    spectralCentroidMeanHz: get("spectralCentroidMeanHz", { min: 0, max: 8000 }),
  };

  // Null pitch fields mean "no voiced pitch detected" — allowed, not invalid.
  for (const key of ["pitchMeanHz", "pitchStdHz", "pitchRangeHz"]) {
    if (input?.[key] === null || input?.[key] === undefined) {
      features[key] = null;
    }
  }

  if (features.durationMs !== null && features.durationMs < 400) {
    errors.push("clip too short for reliable indicators");
  }

  return {
    valid: errors.length === 0,
    errors,
    features: errors.length === 0 ? features : null,
  };
};

// Deterministic interpretation of validated features into observations:
// { type, severity: LOW|MODERATE|HIGH, source: "VOICE_ANALYTICS",
//   evidence, confidence }. Observational language only.
export const interpretVoiceFeatures = (features) => {
  if (!features) return [];
  const observations = [];
  const push = (type, severity, evidence, confidence) =>
    observations.push({
      type,
      severity,
      source: "VOICE_ANALYTICS",
      evidence,
      confidence,
    });

  const speechAmount = features.speechRatio ?? 0;
  const reliable = features.durationMs >= 1500 && speechAmount >= 0.15;

  if (speechAmount < 0.15) {
    push(
      "INSUFFICIENT_SPEECH",
      "LOW",
      "Very little speech detected in this clip — voice indicators are limited.",
      0.8,
    );
    return observations;
  }

  const silenceRatio = features.silenceRatio ?? 0;
  if (silenceRatio > 0.75) {
    push(
      "HIGH_PAUSE_RATIO",
      "HIGH",
      "Speech contains unusually long silent stretches between utterances.",
      reliable ? 0.78 : 0.55,
    );
  } else if (silenceRatio > 0.55) {
    push(
      "HIGH_PAUSE_RATIO",
      "MODERATE",
      "Speech contains frequent pauses between utterances.",
      reliable ? 0.7 : 0.5,
    );
  }

  const longPauses = features.longPauseCount ?? 0;
  if (longPauses >= 4) {
    push(
      "LONG_PAUSES",
      "HIGH",
      "Repeated long pauses detected during the response.",
      reliable ? 0.75 : 0.55,
    );
  } else if (longPauses >= 2) {
    push(
      "LONG_PAUSES",
      "MODERATE",
      "Repeated long pauses detected during the response.",
      reliable ? 0.72 : 0.5,
    );
  }

  if (features.pitchMeanHz && features.pitchStdHz !== null) {
    const cv = features.pitchStdHz / features.pitchMeanHz;
    if (cv > 0.35) {
      push(
        "PITCH_VARIATION_ELEVATED",
        (features.pitchRangeHz ?? 0) > 250 ? "HIGH" : "MODERATE",
        "Pitch varies widely across the response.",
        reliable ? 0.68 : 0.5,
      );
    } else if (cv < 0.08 && speechAmount > 0.3) {
      push(
        "PITCH_VARIATION_LOW",
        "MODERATE",
        "Pitch stays unusually steady across the response.",
        reliable ? 0.62 : 0.5,
      );
    }
  } else {
    push(
      "NO_PITCH_DETECTED",
      "LOW",
      "No stable voiced pitch could be measured — spoken content may be whispered, very quiet, or noisy.",
      0.6,
    );
  }

  if (
    features.rmsMean > 0 &&
    features.rmsVariation / features.rmsMean < 0.25 &&
    speechAmount > 0.3
  ) {
    push(
      "LOW_ENERGY_VARIATION",
      "MODERATE",
      "Speech energy stays unusually flat across the response.",
      reliable ? 0.6 : 0.5,
    );
  }

  const rate = features.speechRateProxy ?? 0;
  if (rate > 6) {
    push(
      "RAPID_SPEECH_PROXY",
      "MODERATE",
      "Speech bursts arrive unusually rapidly; review the transcript for pressured speech.",
      reliable ? 0.6 : 0.5,
    );
  } else if (rate < 1.2 && speechAmount > 0.3) {
    push(
      "SLOW_SPEECH_PROXY",
      "MODERATE",
      "Speech arrives unusually slowly with long gaps; review the transcript.",
      reliable ? 0.6 : 0.5,
    );
  }

  return observations;
};

export const VOICE_OBSERVATION_DISCLAIMER =
  "Supporting voice/speech indicators for human review — not a clinical diagnosis and never used alone to set risk.";
