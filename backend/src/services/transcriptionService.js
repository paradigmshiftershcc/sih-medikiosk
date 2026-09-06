import {
  speechToEnglishText,
  isBhashiniAvailable,
} from "./bhashiniService.js";
import { transcribeWithGemini } from "./geminiTranscribeService.js";

// Provider-agnostic voice layer.
// Bhashini is the intended PRIMARY Indian-language provider; Gemini 3.5
// Transcribe is the SECONDARY/FALLBACK. The clinical chat pipeline only ever
// sees the stable shape { text, language, provider } — never raw audio and
// never provider-specific response structures.

// Frontend language codes mapped to BCP-47 hints for Gemini Transcribe.
// Unknown/"auto" intentionally maps to undefined => automatic detection.
export const LANGUAGE_TO_BCP47 = {
  en: "en-IN",
  hi: "hi-IN",
  mr: "mr-IN",
  gu: "gu-IN",
  bn: "bn-IN",
};

// Audio containers Gemini Transcribe accepts for short voice clips.
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/flac",
  "audio/aac",
]);

// Short push-to-talk clips only: ~6MB of base64 (~4.5MB of audio).
const MAX_AUDIO_BASE64_LENGTH = 6 * 1024 * 1024;

// Minimal container sniffing so we don't trust the frontend MIME alone.
const sniffAudioContainer = (bytes) => {
  if (bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "webm";
  }
  if (bytes.length > 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "ogg";
  }
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45
  ) {
    return "wav";
  }
  if (
    bytes.length > 3 &&
    ((bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) ||
      (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))
  ) {
    return "mp3";
  }
  if (
    bytes.length > 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
  ) {
    return "mp4";
  }
  if (bytes.length > 4 && bytes[0] === 0x66 && bytes[1] === 0x4c && bytes[2] === 0x61 && bytes[3] === 0x43) {
    return "flac";
  }
  return null;
};

const MIME_TO_CONTAINER = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "mp4",
  "audio/x-m4a": "mp4",
  "audio/flac": "flac",
  "audio/aac": "mp4",
};

// Short Bhashini source-language codes for the ASR leg.
const toBhashiniSourceLang = (language) => {
  if (["en", "hi", "mr", "gu", "bn"].includes(language)) return language;
  return "hi";
};

export const transcribeAudio = async ({ audioBase64, mimeType, language }) => {
  if (typeof audioBase64 !== "string" || audioBase64.length === 0) {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }

  // Strip a data-URL prefix if the client sent one; when present it must
  // agree with the claimed MIME type.
  let cleanBase64 = audioBase64;
  const prefixMatch = audioBase64.match(/^data:([^;]+);base64,/i);
  if (prefixMatch) {
    const prefixMime = prefixMatch[1].toLowerCase();
    if (
      !ALLOWED_AUDIO_MIME_TYPES.has(prefixMime) ||
      (mimeType && prefixMime !== String(mimeType).toLowerCase())
    ) {
      throw new Error("INVALID_VOICE_PAYLOAD");
    }
    mimeType = prefixMime;
    cleanBase64 = audioBase64.slice(prefixMatch[0].length);
  }

  const normalizedMime = String(mimeType || "").toLowerCase();
  if (!ALLOWED_AUDIO_MIME_TYPES.has(normalizedMime)) {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }
  if (cleanBase64.length === 0 || cleanBase64.length > MAX_AUDIO_BASE64_LENGTH) {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }

  let audioBytes;
  try {
    audioBytes = Buffer.from(cleanBase64, "base64");
  } catch {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }
  if (audioBytes.length === 0) {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }

  const sniffed = sniffAudioContainer(audioBytes);
  if (!sniffed || sniffed !== MIME_TO_CONTAINER[normalizedMime]) {
    throw new Error("INVALID_VOICE_PAYLOAD");
  }

  const languageCode = LANGUAGE_TO_BCP47[language];

  // PRIMARY: Bhashini only when explicitly enabled with real credentials.
  if (isBhashiniAvailable()) {
    try {
      const text = (
        await speechToEnglishText(cleanBase64, toBhashiniSourceLang(language))
      )?.trim();
      if (!text) {
        throw new Error("BHASHINI_ASR_FAILED");
      }
      console.log(
        `[Transcription] provider=bhashini status=success language=${languageCode || "auto"}`,
      );
      return { text, language: languageCode || "auto", provider: "bhashini" };
    } catch (error) {
      // Single fallback attempt to Gemini Transcribe on 401/403/5xx/network
      // failure. Never logs credentials, headers, or response bodies.
      console.error(
        "[Transcription] Bhashini unavailable; falling back to Gemini Transcribe",
      );
    }
  } else {
    console.log("[Transcription] Bhashini disabled; using Gemini Transcribe");
  }

  // SECONDARY/FALLBACK: Gemini 3.5 Transcribe (also the direct path while
  // Bhashini credentials are pending).
  return transcribeWithGemini({
    audioBase64: cleanBase64,
    mimeType: normalizedMime,
    languageCode,
  });
};
