// Sahaay — client-side voice/speech feature extraction (SIH26093).
//
// Runs entirely in the browser on the already-recorded audio Blob, BEFORE
// upload. Only the compact feature object below is sent to the backend;
// the raw recording is NEVER uploaded for analytics and NEVER persisted.
//
// These are SUPPORTING voice/speech indicators for human review — not a
// clinical diagnosis, not emotion detection, and never used alone to set
// risk. Robust adaptive thresholds; no ML models, no dependencies.

const FRAME_MS = 25;
const HOP_MS = 10;
const MIN_PAUSE_MS = 200;
const LONG_PAUSE_MS = 1000;
const MIN_DURATION_S = 0.4;
const MAX_ANALYZE_S = 60;

// Small iterative radix-2 FFT (real input, returns magnitudes).
const fftMagnitudes = (input) => {
  const n = input.length;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = input[i];
  for (let len = 2; len <= n; len *= 2) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cRe = 1;
      let cIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * cRe - im[i + j + len / 2] * cIm;
        const vIm = re[i + j + len / 2] * cIm + im[i + j + len / 2] * cRe;
        re[i + j] = uRe + vRe;
        im[i + j] = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const nRe = cRe * wRe - cIm * wIm;
        cIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
      }
    }
  }
  // Bit-reversal permutation.
  const mags = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) {
    let rev = 0;
    let x = i;
    for (let b = 0; (1 << b) < n; b++) {
      rev = (rev << 1) | (x & 1);
      x >>= 1;
    }
    if (rev >= i) {
      const aRe = re[i];
      const aIm = im[i];
      re[i] = re[rev];
      im[i] = im[rev];
      re[rev] = aRe;
      im[rev] = aIm;
    }
  }
  for (let k = 0; k < n / 2; k++) {
    mags[k] = Math.sqrt(re[k] * re[k] + im[k] * im[k]);
  }
  return mags;
};

// Autocorrelation pitch estimate for one frame; null when unvoiced.
const estimatePitch = (frame, sampleRate) => {
  const n = frame.length;
  let energy = 0;
  for (let i = 0; i < n; i++) energy += frame[i] * frame[i];
  if (energy < 1e-8) return null;
  const minLag = Math.max(2, Math.floor(sampleRate / 500));
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / 50));
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let i = 0; i < n - lag; i++) corr += frame[i] * frame[i + lag];
    const norm = corr / energy;
    if (norm > bestCorr) {
      bestCorr = norm;
      bestLag = lag;
    }
  }
  if (bestLag < 0 || bestCorr < 0.5) return null;
  return sampleRate / bestLag;
};

const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

const std = (arr, m) => {
  if (!arr.length) return 0;
  const avg = m ?? mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - avg) * (b - avg), 0) / arr.length);
};

// Pure function: Float32Array mono samples + sampleRate -> feature object
// (or null when the clip is unusable). No browser APIs; fully unit-testable.
export const computeVoiceFeatures = (mono, sampleRate) => {
  try {
    if (!mono || !(mono.length > 0) || !Number.isFinite(sampleRate) || sampleRate <= 0) {
      return null;
    }
    const usableLen = Math.min(mono.length, Math.floor(MAX_ANALYZE_S * sampleRate));
    const durationMs = Math.round((usableLen / sampleRate) * 1000);
    if (usableLen / sampleRate < MIN_DURATION_S) return null;

    const frameLen = Math.max(16, Math.round((FRAME_MS / 1000) * sampleRate));
    const hopLen = Math.max(8, Math.round((HOP_MS / 1000) * sampleRate));
    const frameCount = Math.max(1, Math.floor((usableLen - frameLen) / hopLen) + 1);

    const rms = new Float64Array(frameCount);
    for (let f = 0; f < frameCount; f++) {
      const start = f * hopLen;
      let sum = 0;
      const end = Math.min(start + frameLen, usableLen);
      for (let i = start; i < end; i++) sum += mono[i] * mono[i];
      rms[f] = Math.sqrt(sum / Math.max(1, end - start));
    }

    // Adaptive speech threshold from the clip itself.
    const sorted = [...rms].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
    const peak = sorted[sorted.length - 1] ?? 0;
    const threshold = Math.max(p10 * 3, peak * 0.05, 0.005);

    const voiced = new Array(frameCount);
    let voicedCount = 0;
    for (let f = 0; f < frameCount; f++) {
      voiced[f] = rms[f] > threshold;
      if (voiced[f]) voicedCount++;
    }
    const speechRatio = voicedCount / frameCount;
    const silenceRatio = 1 - speechRatio;

    // Pause runs (unvoiced runs >= MIN_PAUSE_MS) and speech bursts.
    const minPauseFrames = Math.max(1, Math.round(MIN_PAUSE_MS / HOP_MS));
    const pauses = [];
    let run = 0;
    for (let f = 0; f <= frameCount; f++) {
      if (f < frameCount && !voiced[f]) {
        run++;
      } else {
        if (run >= minPauseFrames) pauses.push((run * HOP_MS));
        run = 0;
      }
    }
    const pauseCount = pauses.length;
    const meanPauseMs = pauseCount ? Math.round(mean(pauses)) : 0;
    const longPauseCount = pauses.filter((p) => p >= LONG_PAUSE_MS).length;

    const voicedRms = [];
    for (let f = 0; f < frameCount; f++) if (voiced[f]) voicedRms.push(rms[f]);
    const rmsMean = voicedRms.length ? mean(voicedRms) : 0;
    const rmsVariation = voicedRms.length > 1 ? std(voicedRms, rmsMean) : 0;

    // Pitch on a subsample of voiced frames (perf-bounded).
    const pitches = [];
    let pitchBudget = 400;
    for (let f = 0; f < frameCount && pitchBudget > 0; f += 5) {
      if (!voiced[f]) continue;
      const start = f * hopLen;
      const frame = mono.subarray(start, Math.min(start + frameLen, usableLen));
      const f0 = estimatePitch(frame, sampleRate);
      if (f0) pitches.push(f0);
      pitchBudget--;
    }
    const pitchMeanHz = pitches.length ? Math.round(mean(pitches)) : null;
    const pitchStdHz = pitches.length > 1 ? Math.round(std(pitches)) : pitches.length ? 0 : null;
    const pitchRangeHz =
      pitches.length > 1 ? Math.round(Math.max(...pitches) - Math.min(...pitches)) : pitches.length ? 0 : null;

    // Speech-rate proxy: speech bursts per second of audio.
    const minBurstFrames = Math.max(1, Math.round(120 / HOP_MS));
    const minGapFrames = Math.max(1, Math.round(150 / HOP_MS));
    let bursts = 0;
    let vRun = 0;
    let gap = minGapFrames;
    for (let f = 0; f <= frameCount; f++) {
      if (f < frameCount && voiced[f]) {
        vRun++;
        gap = 0;
      } else {
        gap++;
        // Count a burst once its trailing silence reaches the split gap.
        // Shorter gaps keep the burst open (vRun is preserved).
        if (vRun >= minBurstFrames && gap >= minGapFrames) {
          bursts++;
          vRun = 0;
        } else if (gap >= minGapFrames) {
          vRun = 0;
        }
      }
    }
    if (vRun >= minBurstFrames) bursts++;
    const speechRateProxy = Math.round((bursts / (usableLen / sampleRate)) * 10) / 10;

    // Spectral centroid (mean over a subsample of frames).
    const FFT_N = 512;
    const centroids = [];
    for (let f = 0; f < frameCount; f += 5) {
      const start = f * hopLen;
      const buf = new Float64Array(FFT_N);
      const copyLen = Math.min(frameLen, FFT_N, usableLen - start);
      let frameEnergy = 0;
      for (let i = 0; i < copyLen; i++) {
        // Hann window.
        const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / Math.max(1, copyLen - 1)));
        buf[i] = mono[start + i] * w;
        frameEnergy += mono[start + i] * mono[start + i];
      }
      if (frameEnergy < 1e-8) continue;
      const mags = fftMagnitudes(buf);
      let num = 0;
      let den = 0;
      for (let k = 1; k < mags.length; k++) {
        num += k * mags[k];
        den += mags[k];
      }
      if (den > 0) centroids.push((num / den) * (sampleRate / FFT_N));
    }
    const spectralCentroidMeanHz = centroids.length ? Math.round(mean(centroids)) : 0;

    return {
      durationMs,
      speechRatio: Math.round(speechRatio * 1000) / 1000,
      silenceRatio: Math.round(silenceRatio * 1000) / 1000,
      pauseCount,
      meanPauseMs,
      longPauseCount,
      rmsMean: Math.round(rmsMean * 10000) / 10000,
      rmsVariation: Math.round(rmsVariation * 10000) / 10000,
      pitchMeanHz,
      pitchStdHz,
      pitchRangeHz,
      speechRateProxy,
      spectralCentroidMeanHz,
    };
  } catch {
    return null;
  }
};

// Browser wrapper: decode any recorded Blob to mono and analyze.
// Used where the WAV-encode path is not already decoding.
export const analyzeAudioBlob = async (blob) => {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  const ctx = new AudioCtx();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    if (!decoded.duration || decoded.length === 0) return null;
    const channels = [];
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      channels.push(decoded.getChannelData(c));
    }
    const mono = new Float32Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      let sum = 0;
      for (let c = 0; c < channels.length; c++) sum += channels[c][i];
      mono[i] = sum / channels.length;
    }
    return computeVoiceFeatures(mono, decoded.sampleRate);
  } catch {
    return null;
  } finally {
    if (ctx.close) await ctx.close().catch(() => {});
  }
};
