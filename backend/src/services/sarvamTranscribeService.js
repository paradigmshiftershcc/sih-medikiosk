import axios from "axios";

// Secondary/fallback speech-to-text provider: Sarvam Saaras v3.
// Uses the current synchronous REST API documented at
// https://docs.sarvam.ai/api-reference/speech-to-text/transcribe :
// POST https://api.sarvam.ai/speech-to-text (multipart/form-data) with
// header `api-subscription-key`, fields model=`saaras:v3`,
// mode=`transcribe`, optional BCP-47 `language_code`, and the audio `file`.
// WebM is an explicitly supported input format, so short push-to-talk clips
// are sent from memory: no temp files, no persisted patient audio.
const SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text";
const MODEL = "saaras:v3";
const MODE = "transcribe";

// Patient-facing interactive operation: bounded wait per attempt.
// The sync REST API answers short clips in seconds, so 20s leaves headroom
// without leaving the microphone UI stuck in "Transcribing".
const TRANSCRIBE_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 1000;

const MIME_TO_EXTENSION = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
  "audio/aac": "aac",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Placeholder values must never count as a configured key.
const hasRealKey = () => {
  const key = String(process.env.SARVAM_API_KEY || "").trim();
  if (key.length < 8) return false;
  return !["...", "xxx", "test", "placeholder", "changeme"].includes(
    key.toLowerCase(),
  );
};

const isTransientError = (error) => {
  // No response at all (network failure/DNS/timeout) is transient.
  if (!error?.response) return true;
  const status = error.response.status;
  return status === 429 || status === 502 || status === 503 || status === 504;
};

// Transcribes base64 audio (no data-URL prefix) to plain text.
// languageCode is a BCP-47 hint (e.g. "hi-IN"); omit it for auto-detection
// (the API returns the detected code, which we prefer when present).
// Returns { text, language, provider }. Never returns provider internals.
export const transcribeWithSarvam = async ({
  audioBase64,
  mimeType,
  languageCode,
}) => {
  if (!hasRealKey()) {
    throw new Error("TRANSCRIPTION_UNAVAILABLE");
  }

  const extension = MIME_TO_EXTENSION[mimeType] || "webm";
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const buildForm = () => {
    const form = new FormData();
    form.append(
      "file",
      new Blob([audioBuffer], { type: mimeType }),
      `audio.${extension}`,
    );
    form.append("model", MODEL);
    form.append("mode", MODE);
    if (languageCode) {
      form.append("language_code", languageCode);
    }
    return form;
  };

  // At most one retry for transient errors, then a controlled failure.
  // 400/401/403/422 fail fast: retrying cannot fix them.
  let attemptsLeft = 1;

  while (true) {
    const start = Date.now();
    try {
      const { data } = await axios.post(SARVAM_STT_URL, buildForm(), {
        headers: { "api-subscription-key": process.env.SARVAM_API_KEY },
        timeout: TRANSCRIBE_TIMEOUT_MS,
      });
      const text = (data?.transcript || "").trim();
      if (!text) {
        throw new Error("EMPTY_TRANSCRIPTION");
      }
      const language = data?.language_code || languageCode || "auto";
      console.log(
        `[Transcription] provider=sarvam-saaras language=${language} duration=${Date.now() - start}ms`,
      );
      return { text, language, provider: "sarvam-saaras" };
    } catch (error) {
      const duration = Date.now() - start;
      // Internal category only: HTTP status when known, otherwise the
      // failure class. Never logs the key, audio, transcripts, or bodies.
      let status;
      if (error?.code === "ECONNABORTED") status = "timeout";
      else if (error?.message === "EMPTY_TRANSCRIPTION") status = "empty-response";
      else if (error?.message === "TRANSCRIPTION_UNAVAILABLE") status = "no-credentials";
      else status = error?.response?.status || "network";
      console.error(
        `[Transcription] provider=sarvam-saaras mime=${mimeType} failed status=${status} duration=${duration}ms`,
      );
      if (isTransientError(error) && attemptsLeft > 0) {
        attemptsLeft -= 1;
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw new Error("TRANSCRIPTION_FAILED");
    }
  }
};
