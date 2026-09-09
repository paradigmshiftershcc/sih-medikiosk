// Phase 3: individual Bhashini capability tests (ASR / NMT / TTS).
// Discovers serviceIds + inference token via the documented config call,
// then runs each capability independently. Safe diagnostics only:
// task, status, transcript length/preview (first 60 chars), audio bytes,
// service IDs. No keys, tokens, headers, or full payloads are printed.
import axios from "axios";
import dotenv from "dotenv";
import { readFileSync } from "node:fs";

dotenv.config();

const CONFIG_URL =
  "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";

const isPlaceholder = (v) =>
  !v ||
  v.trim().length < 4 ||
  ["...", "xxx", "test", "placeholder", "changeme"].includes(
    v.trim().toLowerCase(),
  );

const userID = process.env.BHASHINI_USER_ID;
const ulcaKey =
  process.env.BHASHINI_ULCA_API_KEY || process.env.BHASHINI_API_KEY;
const PIPELINE_ID = "64392f96daac500b55c543cd";

if (isPlaceholder(userID) || isPlaceholder(ulcaKey)) {
  console.log("RESULT: BLOCKED — real credentials required");
  process.exit(2);
}

const preview = (s) =>
  typeof s === "string" ? s.slice(0, 60) + (s.length > 60 ? "…" : "") : "MISSING";

const findService = (configData, taskType, src, tgt) => {
  const task = (configData?.pipelineResponseConfig || []).find(
    (t) => t.taskType === taskType,
  );
  const hit = (task?.config || []).find(
    (c) =>
      c.language?.sourceLanguage === src &&
      (tgt === undefined || c.language?.targetLanguage === tgt),
  );
  return hit?.serviceId || null;
};

const configFor = async (label, pipelineTasks) => {
  const { data } = await axios.post(
    CONFIG_URL,
    { pipelineTasks, pipelineRequestConfig: { pipelineId: PIPELINE_ID } },
    { headers: { userID, ulcaApiKey: ulcaKey }, timeout: 20000 },
  );
  const endpoint = data?.pipelineInferenceAPIEndPoint || {};
  console.log(
    `${label}: tokenIssued=${Boolean(endpoint.inferenceApiKey?.value)} host=${new URL(endpoint.callbackUrl).hostname}`,
  );
  return {
    url: endpoint.callbackUrl,
    authName: endpoint.inferenceApiKey?.name || "Authorization",
    authValue: endpoint.inferenceApiKey?.value,
    data,
  };
};

const compute = async (url, authName, authValue, body, timeoutMs = 30000) => {
  const { status, data } = await axios.post(url, body, {
    headers: { [authName]: authValue },
    timeout: timeoutMs,
  });
  return { status, data };
};

// ---- discover ----
const asrNmt = await configFor("config[ASR+NMT hi->en]", [
  { taskType: "asr", config: { language: { sourceLanguage: "hi" } } },
  {
    taskType: "translation",
    config: { language: { sourceLanguage: "hi", targetLanguage: "en" } },
  },
]);
const nmtTts = await configFor("config[NMT+TTS en->hi]", [
  {
    taskType: "translation",
    config: { language: { sourceLanguage: "en", targetLanguage: "hi" } },
  },
  { taskType: "tts", config: { language: { sourceLanguage: "hi" } } },
]);

const asrService = findService(asrNmt.data, "asr", "hi");
const hiEnService = findService(asrNmt.data, "translation", "hi", "en");
const enHiService = findService(nmtTts.data, "translation", "en", "hi");
const ttsService = findService(nmtTts.data, "tts", "hi");
console.log(`services: asr=${asrService} hiEn=${hiEnService} enHi=${enHiService} tts=${ttsService}`);
if (!asrService || !hiEnService || !enHiService || !ttsService) {
  console.log("RESULT: FAILED — service discovery incomplete");
  process.exit(1);
}
const { url, authName, authValue } = asrNmt; // same endpoint+auth for both

// ---- TEST 1: Hindi audio -> ASR -> Hindi text ----
const wavB64 = readFileSync("/tmp/bh_hi.wav").toString("base64");
let r = await compute(url, authName, authValue, {
  pipelineTasks: [
    {
      taskType: "asr",
      config: {
        language: { sourceLanguage: "hi" },
        serviceId: asrService,
        audioFormat: "wav",
        samplingRate: 16000,
      },
    },
  ],
  inputData: { audio: [{ audioContent: wavB64 }] },
});
const hindiText = r.data?.pipelineResponse?.find((t) => t.taskType === "asr")
  ?.output?.[0]?.source;
console.log(`TEST1 ASR: http=${r.status} text=${JSON.stringify(preview(hindiText))}`);

// ---- TEST 2: Hindi text -> NMT -> English ----
r = await compute(url, authName, authValue, {
  pipelineTasks: [
    {
      taskType: "translation",
      config: {
        language: { sourceLanguage: "hi", targetLanguage: "en" },
        serviceId: hiEnService,
      },
    },
  ],
  inputData: { input: [{ source: "मुझे सिर दर्द हो रहा है" }] },
});
const englishText = r.data?.pipelineResponse?.find(
  (t) => t.taskType === "translation",
)?.output?.[0]?.target;
console.log(`TEST2 HI->EN: http=${r.status} text=${JSON.stringify(preview(englishText))}`);

// ---- TEST 3: English text -> NMT -> Hindi ----
r = await compute(url, authName, authValue, {
  pipelineTasks: [
    {
      taskType: "translation",
      config: {
        language: { sourceLanguage: "en", targetLanguage: "hi" },
        serviceId: enHiService,
      },
    },
  ],
  inputData: { input: [{ source: "I have a headache" }] },
});
const backHindi = r.data?.pipelineResponse?.find(
  (t) => t.taskType === "translation",
)?.output?.[0]?.target;
console.log(`TEST3 EN->HI: http=${r.status} text=${JSON.stringify(preview(backHindi))}`);

// ---- TEST 4: Hindi text -> TTS -> audio ----
r = await compute(
  url,
  authName,
  authValue,
  {
    pipelineTasks: [
      {
        taskType: "tts",
        config: {
          language: { sourceLanguage: "hi" },
          serviceId: ttsService,
          gender: "female",
        },
      },
    ],
    inputData: { input: [{ source: "आपको सिर दर्द है" }] },
  },
  45000,
);
const audioB64 = r.data?.pipelineResponse?.find((t) => t.taskType === "tts")
  ?.audio?.[0]?.audioContent;
console.log(`TEST4 TTS: http=${r.status} audioBytes=${audioB64?.length || 0}`);
if (audioB64) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync("/tmp/bh_tts_out.wav", Buffer.from(audioB64, "base64"));
  console.log("tts sample saved to /tmp/bh_tts_out.wav (verify header below)");
}

console.log("RESULT: capability tests complete");
