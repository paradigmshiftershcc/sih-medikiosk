import axios from "axios";

// REAL Bhashini ULCA integration (verified against the current official
// Bhashini API docs, https://dibd-bhashini.gitbook.io/bhashini-apis).
//
// Auth model (official docs win over any remembered format):
// 1. Pipeline Config (mandatory): POST
//    https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
//    with headers `userID` + `ulcaApiKey` (dashboard UDYAT KEY).
//    Response yields per-task serviceIds plus
//    pipelineInferenceAPIEndPoint { callbackUrl, inferenceApiKey }.
// 2. Pipeline Compute (mandatory): POST the callbackUrl (Dhruva inference
//    host) with the dynamic `Authorization` token from step 1.
// Languages are ISO-639 short codes (hi, en, ...), NOT BCP-47.
// ASR audio must be wav (preferred) — never assume webm/mp4 is accepted.
//
// Flows (two pipelines, same endpoint + auth mechanism):
//   voice:     [ASR hi -> NMT hi->en]  (BHASHINI_ASR_NMT_PIPELINE_ID)
//   response:  [NMT en->hi -> TTS hi]   (BHASHINI_NMT_TTS_PIPELINE_ID)

const CONFIG_URL =
  "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";
const DHRUVA_URL = "https://dhruva-api.bhashini.gov.in/services/inference/pipeline";
// Pipeline ID discovered via the official Pipeline Search + Config workflow
// for this Udyat app; proven to support both [ASR+NMT hi->en] and
// [NMT+TTS en->hi] on the same endpoint with the same auth mechanism.
const DISCOVERED_PIPELINE_ID = "64392f96daac500b55c543cd";

const CONFIG_TIMEOUT_MS = 20000;
const ASR_TIMEOUT_MS = 40000;
const NMT_TIMEOUT_MS = 25000;
const TTS_TIMEOUT_MS = 40000;
const CONFIG_TTL_MS = 30 * 60 * 1000;

// Only Hindi voice I/O is verified end-to-end so far. Other languages stay
// on the Sarvam fallback until their pipelines are verified.
const VERIFIED_VOICE_LANGS = new Set(["hi"]);

// Placeholder values must never count as configured credentials.
const PLACEHOLDER_VALUES = new Set([
  "...",
  "xxx",
  "test",
  "placeholder",
  "changeme",
  "todo",
  "none",
  "null",
]);

const looksConfigured = (value) => {
  const trimmed = String(value || "").trim();
  if (trimmed.length < 4) return false;
  return !PLACEHOLDER_VALUES.has(trimmed.toLowerCase());
};

const getUserId = () => process.env.BHASHINI_USER_ID;
// UDYAT KEY authenticates the config call (documented `ulcaApiKey` header).
const getUlcaKey = () =>
  process.env.BHASHINI_ULCA_API_KEY || process.env.BHASHINI_API_KEY;
const getInferenceKey = () => process.env.BHASHINI_INFERENCE_KEY;
const getPipelineId = (kind) =>
  (kind === "nmtTts"
    ? process.env.BHASHINI_NMT_TTS_PIPELINE_ID
    : process.env.BHASHINI_ASR_NMT_PIPELINE_ID) || DISCOVERED_PIPELINE_ID;

// Check if Bhashini is configured (credentials present, regardless of flag).
const isConfigured = () => {
  return (
    looksConfigured(getUserId()) &&
    looksConfigured(getUlcaKey())
  );
};

// Public availability check for the provider-agnostic transcription layer.
// Strictly opt-in: attempted only when BHASHINI_ENABLED=true AND real
// credentials are present. Otherwise the voice layer skips Bhashini
// completely (no 401 attempts) and uses the Sarvam fallback.
export const isBhashiniAvailable = () => {
  if (String(process.env.BHASHINI_ENABLED || "").toLowerCase() !== "true") {
    return false;
  }
  return Boolean(isConfigured());
};

const requireVerifiedVoiceLang = (lang, op) => {
  if (!VERIFIED_VOICE_LANGS.has(lang)) {
    throw new Error("BHASHINI_UNSUPPORTED_LANGUAGE");
  }
};

// ---- pipeline config (cached) ----
const configCache = new Map();

const fetchPipelineConfig = async (kind, pipelineTasks) => {
  const pipelineId = getPipelineId(kind);
  const { data } = await axios.post(
    CONFIG_URL,
    { pipelineTasks, pipelineRequestConfig: { pipelineId } },
    {
      headers: { userID: getUserId(), ulcaApiKey: getUlcaKey() },
      timeout: CONFIG_TIMEOUT_MS,
    },
  );
  const endpoint = data?.pipelineInferenceAPIEndPoint || {};
  if (!endpoint.callbackUrl || !endpoint.inferenceApiKey?.value) {
    throw new Error("BHASHINI_CONFIG_FAILED");
  }
  let host = "unknown-host";
  try {
    host = new URL(endpoint.callbackUrl).hostname;
  } catch { /* keep unknown-host */ }
  console.log(
    `[Bhashini] Config ok kind=${kind} pipeline=${pipelineId} host=${host}`,
  );
  return {
    url: endpoint.callbackUrl,
    authName: endpoint.inferenceApiKey.name || "Authorization",
    authValue: endpoint.inferenceApiKey.value,
    response: data,
  };
};

const getFlowConfig = async (kind, pipelineTasks) => {
  const key = `${getPipelineId(kind)}:${JSON.stringify(pipelineTasks)}`;
  const cached = configCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.entry;
  try {
    const entry = await fetchPipelineConfig(kind, pipelineTasks);
    configCache.set(key, { entry, expiresAt: Date.now() + CONFIG_TTL_MS });
    return entry;
  } catch (error) {
    // Fallback: static dashboard INFERENCE KEY against Dhruva directly.
    if (looksConfigured(getInferenceKey())) {
      console.error(
        "[Bhashini] Config unavailable; using static inference key",
      );
      return {
        url: DHRUVA_URL,
        authName: "Authorization",
        authValue: getInferenceKey(),
        response: null,
        staticKey: true,
      };
    }
    throw error;
  }
};

const invalidateFlowConfig = (kind, pipelineTasks) => {
  const key = `${getPipelineId(kind)}:${JSON.stringify(pipelineTasks)}`;
  configCache.delete(key);
};

const findServiceId = (configResponse, taskType, sourceLanguage, targetLanguage) => {
  const task = (configResponse?.pipelineResponseConfig || []).find(
    (t) => t.taskType === taskType,
  );
  const hit = (task?.config || []).find(
    (c) =>
      c.language?.sourceLanguage === sourceLanguage &&
      (targetLanguage === undefined ||
        c.language?.targetLanguage === targetLanguage),
  );
  return hit?.serviceId || null;
};

const sanitizeComputeError = (op, error) => {
  // Never log headers, bodies, keys, audio, or transcripts.
  const status = error?.response?.status;
  const code = error?.code;
  if (code === "ECONNABORTED") return "BHASHINI_TIMEOUT";
  if (status === 400 || status === 422) return "BHASHINI_BAD_REQUEST";
  if (status === 401 || status === 403) return "BHASHINI_AUTH_FAILED";
  return `BHASHINI_${op}_FAILED`;
};

// Generic single-task compute with one re-config retry on auth failure.
const runTask = async ({
  kind,
  configTasks,
  taskBody,
  timeoutMs,
  op,
  serviceLookup,
}) => {
  if (!isConfigured()) {
    console.warn("[Bhashini] Not configured — using development fallback.");
    throw new Error("BHASHINI_NOT_CONFIGURED");
  }
  const start = Date.now();
  const attempt = async (retried) => {
    const cfg = await getFlowConfig(kind, configTasks);
    let serviceId = null;
    if (!cfg.staticKey && serviceLookup) {
      serviceId = findServiceId(cfg.response, ...serviceLookup);
      if (!serviceId) throw new Error("BHASHINI_CONFIG_FAILED");
    }
    const body = JSON.parse(JSON.stringify(taskBody));
    if (serviceId) body.pipelineTasks[0].config.serviceId = serviceId;
    try {
      const { status, data } = await axios.post(cfg.url, body, {
        headers: { [cfg.authName]: cfg.authValue },
        timeout: timeoutMs,
      });
      console.log(
        `[Bhashini] Compute ok op=${op} status=${status} duration=${Date.now() - start}ms`,
      );
      return data;
    } catch (error) {
      const mapped = sanitizeComputeError(op, error);
      console.error(
        `[Bhashini] Compute failed op=${op} status=${error?.response?.status || "network/timeout"}`,
      );
      if (
        !retried &&
        (error?.response?.status === 401 || error?.response?.status === 403) &&
        !cfg.staticKey
      ) {
        invalidateFlowConfig(kind, configTasks);
        return attempt(true);
      }
      throw new Error(mapped);
    }
  };
  return attempt(false);
};

// ---- modular operations ----
export const speechToText = async ({ audioBase64, sourceLang = "hi" }) => {
  requireVerifiedVoiceLang(sourceLang, "ASR");
  const data = await runTask({
    kind: "asrNmt",
    configTasks: [
      { taskType: "asr", config: { language: { sourceLanguage: sourceLang } } },
      {
        taskType: "translation",
        config: {
          language: { sourceLanguage: sourceLang, targetLanguage: "en" },
        },
      },
    ],
    taskBody: {
      pipelineTasks: [
        {
          taskType: "asr",
          config: {
            language: { sourceLanguage: sourceLang },
            audioFormat: "wav",
            samplingRate: 16000,
          },
        },
      ],
      inputData: { audio: [{ audioContent: audioBase64 }] },
    },
    timeoutMs: ASR_TIMEOUT_MS,
    op: "ASR",
    serviceLookup: ["asr", sourceLang, undefined],
  });
  const text = data?.pipelineResponse?.find((t) => t.taskType === "asr")
    ?.output?.[0]?.source;
  if (!text?.trim()) throw new Error("BHASHINI_ASR_FAILED");
  return text.trim();
};

export const translateText = async ({ text, sourceLang, targetLang }) => {
  if (!text?.trim()) throw new Error("BHASHINI_BAD_REQUEST");
  const kind = sourceLang === "en" ? "nmtTts" : "asrNmt";
  const tasks =
    kind === "nmtTts"
      ? [
          {
            taskType: "translation",
            config: { language: { sourceLanguage: "en", targetLanguage: targetLang } },
          },
          { taskType: "tts", config: { language: { sourceLanguage: targetLang } } },
        ]
      : [
          { taskType: "asr", config: { language: { sourceLanguage: sourceLang } } },
          {
            taskType: "translation",
            config: { language: { sourceLanguage: sourceLang, targetLanguage: targetLang } },
          },
        ];
  const data = await runTask({
    kind,
    configTasks: tasks,
    taskBody: {
      pipelineTasks: [
        {
          taskType: "translation",
          config: { language: { sourceLanguage: sourceLang, targetLanguage: targetLang } },
        },
      ],
      inputData: { input: [{ source: text }] },
    },
    timeoutMs: NMT_TIMEOUT_MS,
    op: "NMT",
    serviceLookup: ["translation", sourceLang, targetLang],
  });
  const out = data?.pipelineResponse?.find((t) => t.taskType === "translation")
    ?.output?.[0]?.target;
  if (!out?.trim()) throw new Error("BHASHINI_NMT_FAILED");
  return out.trim();
};

export const textToSpeech = async ({ text, lang = "hi", gender = "female" }) => {
  requireVerifiedVoiceLang(lang, "TTS");
  if (!text?.trim()) throw new Error("BHASHINI_BAD_REQUEST");
  const data = await runTask({
    kind: "nmtTts",
    configTasks: [
      {
        taskType: "translation",
        config: { language: { sourceLanguage: "en", targetLanguage: lang } },
      },
      { taskType: "tts", config: { language: { sourceLanguage: lang } } },
    ],
    taskBody: {
      pipelineTasks: [
        {
          taskType: "tts",
          config: { language: { sourceLanguage: lang }, gender },
        },
      ],
      inputData: { input: [{ source: text }] },
    },
    timeoutMs: TTS_TIMEOUT_MS,
    op: "TTS",
    serviceLookup: ["tts", lang, undefined],
  });
  const audio = data?.pipelineResponse?.find((t) => t.taskType === "tts")
    ?.audio?.[0]?.audioContent;
  if (!audio) throw new Error("BHASHINI_TTS_FAILED");
  return { audioBase64: audio, mimeType: "audio/wav" };
};

// ---- orchestration (existing shapes preserved) ----
export const speechToEnglishText = async (base64Audio, sourceLang = "hi") => {
  requireVerifiedVoiceLang(sourceLang, "ASR");
  const hindiText = await speechToText({ audioBase64: base64Audio, sourceLang });
  if (sourceLang === "en") return hindiText;
  return translateText({ text: hindiText, sourceLang, targetLang: "en" });
};

export const englishTextToSpeech = async (englishText, targetLang = "hi") => {
  requireVerifiedVoiceLang(targetLang, "TTS");
  if (!isConfigured()) {
    console.warn(
      "[Bhashini] Not configured — using development fallback (English text only).",
    );
    throw new Error("BHASHINI_NOT_CONFIGURED");
  }
  const text = await translateText({
    text: englishText,
    sourceLang: "en",
    targetLang,
  });
  const { audioBase64 } = await textToSpeech({ text, lang: targetLang });
  return { text, audioBase64 };
};
