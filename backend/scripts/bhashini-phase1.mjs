// Phase 1: isolated Bhashini pipeline-config connectivity test.
// Reads credentials ONLY from backend/.env (never prints values).
// Prints safe diagnostics only: status, pipeline/service identifiers,
// task types, language pairs, endpoint hostname. No keys, tokens,
// authorization values, or raw bodies are ever printed.
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const CONFIG_URL =
  "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline";

const mask = (present, placeholder) => {
  if (!present) return "ABSENT";
  return placeholder ? "PLACEHOLDER" : "SET";
};

const isPlaceholder = (v) =>
  !v ||
  v.trim().length < 4 ||
  ["...", "xxx", "test", "placeholder", "changeme"].includes(v.trim().toLowerCase());

const userID = process.env.BHASHINI_USER_ID;
const ulcaKey = process.env.BHASHINI_API_KEY;
const pipelineId = process.env.BHASHINI_PIPELINE_ID;

console.log("=== credential presence (values never printed) ===");
console.log("BHASHINI_USER_ID:", mask(userID, isPlaceholder(userID)));
console.log("BHASHINI_API_KEY (UDYAT KEY):", mask(ulcaKey, isPlaceholder(ulcaKey)));
console.log("BHASHINI_PIPELINE_ID:", mask(pipelineId, isPlaceholder(pipelineId)));

if (isPlaceholder(userID) || isPlaceholder(ulcaKey)) {
  console.log("RESULT: BLOCKED — real userID/UDYAT KEY required in backend/.env");
  process.exit(2);
}

// Phase 1 target: ASR(hi) + Translation(hi->en) pipeline configuration.
const body = {
  pipelineTasks: [
    { taskType: "asr", config: { language: { sourceLanguage: "hi" } } },
    {
      taskType: "translation",
      config: { language: { sourceLanguage: "hi", targetLanguage: "en" } },
    },
  ],
  pipelineRequestConfig: {},
};
if (!isPlaceholder(pipelineId)) {
  body.pipelineRequestConfig.pipelineId = pipelineId;
}

try {
  const { status, data } = await axios.post(CONFIG_URL, body, {
    headers: { userID, ulcaApiKey: ulcaKey },
    timeout: 20000,
  });
  console.log("=== pipeline config ===");
  console.log("httpStatus:", status);
  const endpoint = data?.pipelineInferenceAPIEndPoint || {};
  try {
    console.log("callbackHost:", new URL(endpoint.callbackUrl || "").hostname);
  } catch {
    console.log("callbackHost: MISSING");
  }
  console.log("inferenceAuthHeaderName:", endpoint.inferenceApiKey?.name || "MISSING");
  console.log(
    "inferenceTokenIssued:",
    Boolean(endpoint.inferenceApiKey?.value),
  );
  for (const t of data?.pipelineResponseConfig || []) {
    const langs = (t.config || []).map(
      (c) =>
        `${c.language?.sourceLanguage || "?"}${c.language?.targetLanguage ? "->" + c.language.targetLanguage : ""}:${c.serviceId || "no-service"}`,
    );
    console.log(`task=${t.taskType} services=${t.config?.length || 0} [${langs.join(", ")}]`);
  }
  console.log("RESULT: SUCCESS — config reachable, see tasks above");
} catch (error) {
  console.log("=== pipeline config FAILED ===");
  console.log("httpStatus:", error?.response?.status || "network/timeout");
  const body = error?.response?.data;
  // Print only safe error shape: code/message, never headers or echoes.
  console.log("errorCode:", body?.code || body?.error?.code || "unknown");
  console.log("errorMessage:", body?.message || body?.error?.message || error?.message || "unknown");
  console.log("RESULT: FAILED — see sanitized details above");
  process.exit(1);
}
