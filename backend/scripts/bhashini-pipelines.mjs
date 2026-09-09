// Phase 2: discover + configure Bhashini pipelines for MediKiosk Hindi flows.
// Reads credentials ONLY from backend/.env (never prints values/tokens).
// Safe diagnostics only: pipeline IDs, task types, service/model IDs,
// languages, domains, endpoint hostname, success/failure + sanitized errors.
import axios from "axios";
import dotenv from "dotenv";

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

if (isPlaceholder(userID) || isPlaceholder(ulcaKey)) {
  console.log("RESULT: BLOCKED — real BHASHINI_USER_ID / UDYAT KEY required");
  process.exit(2);
}

// Candidate pipeline IDs from the official Pipeline Search documentation.
const CANDIDATES = {
  initial: "64392f96daac500b55c543cd",
  iitm: "660fa5bec7fb5b0328229016",
  iitb: "660f813c0413087224435d2c",
  iiith: "660f866443e53d4133f65317",
};

const FLOWS = {
  "ASR+NMT hi->en": {
    pipelineTasks: [
      { taskType: "asr", config: { language: { sourceLanguage: "hi" } } },
      {
        taskType: "translation",
        config: { language: { sourceLanguage: "hi", targetLanguage: "en" } },
      },
    ],
  },
  "NMT+TTS en->hi": {
    pipelineTasks: [
      {
        taskType: "translation",
        config: { language: { sourceLanguage: "en", targetLanguage: "hi" } },
      },
      { taskType: "tts", config: { language: { sourceLanguage: "hi" } } },
    ],
  },
};

const summarize = (label, pipelineKey, pipelineId, data) => {
  const endpoint = data?.pipelineInferenceAPIEndPoint || {};
  let host = "MISSING";
  try {
    host = new URL(endpoint.callbackUrl || "").hostname;
  } catch { /* keep MISSING */ }
  console.log(`--- ${label} | pipeline=${pipelineKey} id=${pipelineId} ---`);
  console.log(`callbackHost: ${host}`);
  console.log(`authHeader: ${endpoint.inferenceApiKey?.name || "MISSING"}`);
  console.log(`tokenIssued: ${Boolean(endpoint.inferenceApiKey?.value)}`);
  for (const t of data?.pipelineResponseConfig || []) {
    for (const c of t.config || []) {
      const lang = `${c.language?.sourceLanguage || "?"}${c.language?.targetLanguage ? "->" + c.language.targetLanguage : ""}`;
      console.log(
        `task=${t.taskType} lang=${lang} service=${c.serviceId || "none"} domain=${(c.domain || []).join(",") || "n/a"} voices=${(c.supportedVoices || []).join(",") || "n/a"}`,
      );
    }
  }
};

const probe = async (label, pipelineKey, pipelineId, tasks) => {
  try {
    const { status, data } = await axios.post(
      CONFIG_URL,
      { ...tasks, pipelineRequestConfig: { pipelineId } },
      { headers: { userID, ulcaApiKey: ulcaKey }, timeout: 20000 },
    );
    console.log(`httpStatus: ${status}`);
    summarize(label, pipelineKey, pipelineId, data);
    return true;
  } catch (error) {
    const body = error?.response?.data;
    console.log(`--- ${label} | pipeline=${pipelineKey} FAILED ---`);
    console.log(`httpStatus: ${error?.response?.status || "network/timeout"}`);
    console.log(`errorCode: ${body?.code || body?.error?.code || "unknown"}`);
    console.log(
      `errorMessage: ${body?.message || body?.error?.message || error?.message || "unknown"}`,
    );
    return false;
  }
};

for (const [label, tasks] of Object.entries(FLOWS)) {
  for (const [key, id] of Object.entries(CANDIDATES)) {
    // eslint-disable-next-line no-await-in-loop
    await probe(label, key, id, tasks);
  }
}
console.log("RESULT: discovery complete — see per-pipeline summaries above");
