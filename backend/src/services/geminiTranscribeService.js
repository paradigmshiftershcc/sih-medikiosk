import { GoogleGenAI } from "@google/genai";

// Secondary/fallback speech-to-text provider.
// Uses the current Interactions API documented at
// https://ai.google.dev/gemini-api/docs/transcribe with inline audio data
// (documented for requests under 20MB total), so short push-to-talk clips
// never touch disk: no temp files, no persisted patient audio.
const MODEL = "gemini-3.5-transcribe";

// Patient-facing interactive operation: bounded wait per attempt.
// Live-tested latency for short clips is ~5-8s, so 20s leaves headroom
// without leaving the microphone UI stuck in "Processing".
const TRANSCRIBE_TIMEOUT_MS = 20000;
const RETRY_DELAY_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (error) => {
  const status = error?.status;
  return (
    status === 429 ||
    status === 503 ||
    status === 504 ||
    /429|503|504|timeout|timed out|temporar|overload/i.test(
      error?.message || "",
    )
  );
};

const callTranscribeWithTimeout = (ai, params, timeoutMs) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
  });
  return Promise.race([ai.interactions.create(params), timeoutPromise]);
};

// Transcribes base64 audio (no data-URL prefix) to plain text.
// languageCode is a BCP-47 hint (e.g. "hi-IN"); omit it for auto-detection.
// Returns { text, language, provider }. Never returns provider internals.
export const transcribeWithGemini = async ({
  audioBase64,
  mimeType,
  languageCode,
}) => {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("TRANSCRIPTION_UNAVAILABLE");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const params = {
    model: MODEL,
    input: [{ type: "audio", data: audioBase64, mime_type: mimeType }],
  };
  // Omit language_codes entirely for automatic language detection.
  if (languageCode) {
    params.generation_config = {
      transcription_config: { language_codes: [languageCode] },
    };
  }

  // At most one retry for transient errors, then a controlled failure.
  let attemptsLeft = 1;

  while (true) {
    const start = Date.now();
    try {
      const interaction = await callTranscribeWithTimeout(
        ai,
        params,
        TRANSCRIBE_TIMEOUT_MS,
      );
      const text = (interaction?.output_text || "").trim();
      if (!text) {
        throw new Error("EMPTY_TRANSCRIPTION");
      }
      console.log(
        `[Transcription] provider=gemini-transcribe language=${languageCode || "auto"} duration=${Date.now() - start}ms`,
      );
      return { text, language: languageCode || "auto", provider: "gemini-transcribe" };
    } catch (error) {
      const duration = Date.now() - start;
      // Internal category only: HTTP status when known, otherwise the
      // failure class. Never logs audio, transcripts, or keys.
      let status;
      if (error?.message === "REQUEST_TIMEOUT") status = "timeout";
      else if (error?.message === "EMPTY_TRANSCRIPTION") status = "empty-response";
      else if (error?.message === "TRANSCRIPTION_UNAVAILABLE") status = "no-credentials";
      else status = error?.status || "network";
      console.error(
        `[Transcription] provider=gemini-transcribe failed status=${status} duration=${duration}ms`,
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
