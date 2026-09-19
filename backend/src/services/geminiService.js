import { GoogleGenAI } from "@google/genai";

const PRIMARY_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-3.6-flash";
const CHAT_TIMEOUT_MS = 5000; // Interactive timeout
const MODEL_COOLDOWN_MS = 50000; // Cooldown period for unavailable models

// In-memory model health tracking (process-level, not persisted)
const modelHealth = {
  [PRIMARY_MODEL]: { available: true, failureCount: 0, cooldownUntil: 0 },
  [FALLBACK_MODEL]: { available: true, failureCount: 0, cooldownUntil: 0 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientError = (error) => {
  const status = error?.status;

  return (
    status === 429 ||
    status === 503 ||
    status === 504 ||
    /429|503|504|timeout|timed out|temporar/i.test(error?.message || "")
  );
};

const isModelInCooldown = (model) => {
  const health = modelHealth[model];
  if (!health) return false;
  return Date.now() < health.cooldownUntil;
};

const markModelFailure = (model) => {
  if (modelHealth[model]) {
    modelHealth[model].failureCount += 1;
    // After 2 failures, enter cooldown
    if (modelHealth[model].failureCount >= 2) {
      modelHealth[model].cooldownUntil = Date.now() + MODEL_COOLDOWN_MS;
      console.warn(
        `[Gemini API] Model ${model} entering cooldown due to repeated failures.`,
      );
    }
  }
};

const resetModelHealth = (model) => {
  if (modelHealth[model]) {
    modelHealth[model].failureCount = 0;
    modelHealth[model].cooldownUntil = 0;
  }
};

const parseJsonResponse = (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("EMPTY_AI_RESPONSE");
  }

  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  return JSON.parse(cleaned);
};

const CHAT_SCHEMA = {
  type: "object",
  properties: {
    response: {
      type: "string",
      description:
        "Exactly one short, empathetic question or completion message for the patient.",
    },
    redFlags: {
      type: "array",
      items: { type: "string" },
      description: "Critical symptoms explicitly mentioned by the patient.",
    },
    isComplete: {
      type: "boolean",
      description:
        "Whether enough history has been collected or the patient explicitly indicates they are done.",
    },
    nextFocus: {
      type: "string",
      description:
        "The next history area to explore, such as site, onset, character, radiation, associated symptoms, timing, aggravating factors, severity, medical history, medications, or allergies.",
    },
  },
  required: ["response", "redFlags", "isComplete", "nextFocus"],
};

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    chiefComplaint: {
      type: "string",
      description:
        "One precise sentence describing the main reason for consultation using only supported information.",
    },
    hpi: {
      type: "string",
      description:
        "A concise but detailed HPI organized around available SOCRATES elements. Never invent missing information.",
    },
    pastMedicalHistory: {
      type: "array",
      items: { type: "string" },
    },
    medications: {
      type: "array",
      items: { type: "string" },
    },
    allergies: {
      type: "array",
      items: { type: "string" },
    },
    redFlags: {
      type: "array",
      items: { type: "string" },
    },
    ayushSummary: {
      type: ["string", "null"],
    },
    ayushAssessment: {
      type: "object",
      description:
        "Structured Dashavidha Pariksha fields. Populate ONLY from case AYUSH data; use 'Not assessed' when a field is missing.",
      properties: {
        prakriti: { type: "string" },
        vikriti: { type: "string" },
        sara: { type: "string" },
        samhanana: { type: "string" },
        pramana: { type: "string" },
        satmya: { type: "string" },
        sattva: { type: "string" },
        abhyavaharanaShakti: { type: "string" },
        jaranaShakti: { type: "string" },
        vyayamaShakti: { type: "string" },
        vaya: { type: "string" },
        agni: { type: "string" },
        koshtha: { type: "string" },
        ashtavidhaJihva: { type: "string" },
        ashtavidhaNidra: { type: "string" },
        ashtavidhaMutraMala: { type: "string" },
        nidanaAharaHetu: { type: "string" },
        nidanaViharaHetu: { type: "string" },
        nidanaManasikaHetu: { type: "string" },
      },
    },
    documentFindings: {
      type: "array",
      items: { type: "string" },
      description:
        "Important document-derived facts with values and units preserved exactly as documented.",
    },
    missingInformation: {
      type: "array",
      items: { type: "string" },
      description:
        "Important information that was not provided or not established during intake.",
    },
    clinicianAttention: {
      type: "array",
      items: { type: "string" },
      description:
        "Items that deserve clinician review without diagnosing or prescribing.",
    },
  },
  required: [
    "chiefComplaint",
    "hpi",
    "pastMedicalHistory",
    "medications",
    "allergies",
    "redFlags",
    "ayushSummary",
    "documentFindings",
    "missingInformation",
    "clinicianAttention",
  ],
};

const RED_FLAG_PATTERNS = [
  { pattern: /\bchest pain\b/i, label: "Chest pain" },
  {
    pattern: /\bsevere(?:ly)?\s+(?:difficulty|trouble)\s+breath/i,
    label: "Severe difficulty breathing",
  },
  { pattern: /\bshortness of breath\b/i, label: "Shortness of breath" },
  { pattern: /\bbreathlessness\b/i, label: "Breathlessness" },
  {
    pattern: /\bfaint(?:ed|ing)?\b/i,
    label: "Fainting or loss of consciousness",
  },
  { pattern: /\bseizure\b/i, label: "Seizure" },
  { pattern: /\buncontrolled bleeding\b/i, label: "Uncontrolled bleeding" },
  { pattern: /\bheavy bleeding\b/i, label: "Heavy bleeding" },
  { pattern: /\bsudden weakness\b/i, label: "Sudden weakness" },
  { pattern: /\bslurred speech\b/i, label: "Slurred speech" },
  { pattern: /\bface droop(?:ing)?\b/i, label: "Facial drooping" },
];

const detectRedFlags = (transcript = []) => {
  const fullText = transcript.map((message) => message.content || "").join(" ");

  return RED_FLAG_PATTERNS.filter(({ pattern }) => pattern.test(fullText)).map(
    ({ label }) => label,
  );
};

// Helper: Attempt API call with timeout
const callGeminiWithTimeout = async (model, contents, config, timeoutMs) => {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error("REQUEST_TIMEOUT")), timeoutMs);
  });

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const apiCall = ai.models.generateContent({
    model,
    contents,
    config,
  });

  return Promise.race([apiCall, timeoutPromise]);
};

export const generateNextQuestion = async (transcript, options = {}) => {
  const { ayushMode = false, informant = null } = options;

  const companionMode = informant?.type === "companion";
  const companionBlock = companionMode
    ? `
COMPANION MODE (enabled):
This history is being provided by an accompanying person, not the patient
(relationship: ${informant?.relationship || "companion"}). Rules:
- Address the companion directly and ask them to answer on the patient's behalf.
- Phrase questions as "Does the patient..." / "Has the patient..." rather than
  "Do you...".
- Treat all answers as collateral history.
`
    : "";

  const formattedContents = transcript.map((message) => ({
    role: message.role === "model" ? "model" : "user",
    parts: [{ text: message.content }],
  }));

  const systemInstruction = `
You are MediKiosk, a clinical intake assistant for a busy Indian OPD.

Your job is to conduct a concise but clinically useful medical history interview.
You are NOT diagnosing or recommending treatment—only gathering information.

CRITICAL QUESTIONING RULES:

1. Ask EXACTLY ONE short, clear question per turn.
2. Read the entire transcript before responding. NEVER ask a question already clearly answered.
3. If the patient provided multiple details in one response, acknowledge them internally and ask about the next missing high-value detail.
4. Never ask the same question twice, even rephrased.
5. For pain/symptom cases, use SOCRATES internally as a guide:
   - Onset (when did it start?)
   - Site (where is it?)
   - Character (what does it feel like?)
   - Radiation (does it spread?)
   - Associated symptoms (anything else?)
   - Timing (constant vs intermittent, pattern?)
   - Aggravating/relieving factors (what makes it better/worse?)
   - Severity (on a scale of 1-10?)
   Do NOT force every element if not relevant.
6. Prioritize clinically important missing information over optional details.
7. If a potentially serious symptom is explicitly mentioned (chest pain, SOB, etc.), prioritize one brief clarification question.
8. Keep questions plain-language and simple for elderly or low-literacy patients.
9. Never invent a negative finding. Never say "the patient denies nausea" unless explicitly denied.
10. If enough useful history exists, mark isComplete=true.
11. If the patient says "I'm done" or "that's all", mark isComplete=true.

LANGUAGE RULES:
- Plain, conversational tone
- Avoid medical jargon unless the patient already used it
- Use "Tell me more about..." rather than "Elaborate on..."
- Be warm and encouraging

${companionBlock}
AYUSH MODE (enabled):
This interview supports an Ayurvedic consultation (AYUSH OPD). After the chief
complaint and HPI (SOCRATES) are mostly covered, naturally weave in questions
about the patient's constitution and lifestyle, ONE question at a time, using
plain language:
- Digestion & appetite: "How is your appetite lately?" and "Do you feel heavy
  or get gas after meals?" (Ahara Shakti, Agni)
- Bowel habits: "Are your bowel movements regular, or do you feel constipated
  or loose?" (Koshtha)
- Sleep: "How is your sleep — sound, or do you wake up unrefreshed?" (Nidra)
- Tolerance: "Does cold weather or cold food bother you, or heat bother you
  more?" (Satmya)
- Lifestyle triggers: "Do you skip meals, eat late at night, or sleep during
  the day?" (Nidana - Ahara/Vihara hetu)
Rules:
- Blend these across multiple turns; never bundle several AYUSH questions into
  one turn.
- Never re-ask anything the patient has already answered, whether in the
  clinical or AYUSH portion.
- Only run AYUSH questions when the AYUSH mode block is active.

Return ONLY the requested JSON structure.
`;

  const config = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: CHAT_SCHEMA,
    thinkingConfig: {
      thinkingLevel: "low",
    },
  };

  // Bounded fallback: try primary, then fallback if timeout
  const modelsToTry = [
    { model: PRIMARY_MODEL, timeout: CHAT_TIMEOUT_MS },
    { model: FALLBACK_MODEL, timeout: CHAT_TIMEOUT_MS },
  ];

  for (const { model, timeout } of modelsToTry) {
    // Skip if model is in cooldown
    if (isModelInCooldown(model)) {
      console.warn(
        `[Gemini API] Model ${model} is in cooldown, skipping this round.`,
      );
      continue;
    }

    try {
      console.log(
        `[Gemini API] Attempting clinical question with ${model} (timeout: ${timeout}ms).`,
      );

      const response = await callGeminiWithTimeout(
        model,
        formattedContents,
        config,
        timeout,
      );

      const result = parseJsonResponse(response.text);
      resetModelHealth(model);

      const deterministicFlags = detectRedFlags(transcript);
      const modelFlags = Array.isArray(result.redFlags) ? result.redFlags : [];

      console.log(`[Gemini API] Success with ${model}.`);

      return {
        response: result.response,
        redFlags: [...new Set([...modelFlags, ...deterministicFlags])],
        isComplete: Boolean(result.isComplete),
        nextFocus: result.nextFocus || "general history",
      };
    } catch (error) {
      const isTimeout = error.message === "REQUEST_TIMEOUT";

      if (isTimeout) {
        console.warn(
          `[Gemini API] ${model} exceeded timeout (${timeout}ms). Attempting fallback.`,
        );
      } else {
        console.error(
          `[Gemini API] ${model} error: ${error.status || "Unknown"} - ${error.message}`,
        );
      }

      markModelFailure(model);

      // Continue to next model in the list
      continue;
    }
  }

  // Both models exhausted or in cooldown
  console.error(
    "[Gemini API] All models unavailable or in cooldown. Returning graceful fallback.",
  );

  return {
    response: "The service is temporarily busy. Please try again in a moment.",
    redFlags: detectRedFlags(transcript),
    isComplete: false,
    nextFocus: "general history",
  };
};

export const generateClinicalSummary = async (caseRecord) => {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const systemInstruction = `
You are MediKiosk's clinical documentation assistant for a busy Indian OPD.

Your job is to synthesize ONLY information supported by:
1. Patient conversation
2. Medical document extraction
3. AYUSH profiling

This is a documentation and summarization task.
It is NOT diagnosis.
It is NOT treatment recommendation.

STRICT RULES:

1. Never invent facts.
2. Never infer a diagnosis.
3. Never invent negative findings.
4. Never write "no nausea", "no allergy", "no fever", etc. unless this was explicitly established.
5. Distinguish patient-reported information from document-derived information.
6. Preserve exact medical values and units from documents.
7. Keep document reference ranges separate from measured values.
8. Do not convert a reference range into a diagnosis.
9. If information is missing, write "Not provided" or include it in missingInformation.
10. If a document field is uncertain, preserve that uncertainty.
11. Red flags should represent symptoms requiring clinician attention, not diagnoses.
12. AYUSH data should be summarized descriptively. Do not assign an Ayurvedic diagnosis.
13. When AYUSH data is present, populate ayushAssessment with the Dashavidha fields,
    mapping each field exactly as reported (e.g., agni "Manda", koshtha "Krura").
    Use "Not assessed" for any Dashavidha field absent from the AYUSH data. Do not
    infer a field value that was not recorded.
14. The HPI should be specific, compact, and organized around relevant SOCRATES elements.
15. Avoid repeating the same fact in multiple sections unless clinically useful.
16. Return ONLY the requested JSON structure.

For HPI, use this format when applicable:

Onset:
Site:
Character:
Radiation:
Associated symptoms:
Timing:
Aggravating/relieving factors:
Severity:

Only include fields supported by the record.
`;

  const promptContent = `
PATIENT / CASE DATA

--- CHAT TRANSCRIPT ---
${JSON.stringify(caseRecord.transcript || [])}

--- OCR / DOCUMENT DATA ---
${JSON.stringify(caseRecord.ocrData || {})}

--- AYUSH PROFILE ---
${JSON.stringify(caseRecord.ayushData || {})}

--- EXISTING RED FLAGS ---
${JSON.stringify(caseRecord.redFlags || [])}
`;

  let attemptsLeft = 2;
  let delay = 1000;

  while (true) {
    try {
      console.log(
        `[Gemini API] Generating clinical summary with ${PRIMARY_MODEL}.`,
      );

      const response = await ai.models.generateContent({
        model: PRIMARY_MODEL,
        contents: promptContent,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: SUMMARY_SCHEMA,
          thinkingConfig: {
            thinkingLevel: "medium",
          },
        },
      });

      const summary = parseJsonResponse(response.text);

      console.log("[Gemini API] Clinical summary generated successfully.");

      return {
        ...summary,
        redFlags: [
          ...new Set([
            ...(Array.isArray(summary.redFlags) ? summary.redFlags : []),
            ...(Array.isArray(caseRecord.redFlags) ? caseRecord.redFlags : []),
          ]),
        ],
      };
    } catch (error) {
      console.error(
        `[Gemini API] Summary error: ${error.status || "Unknown"} - ${error.message}`,
      );

      if (isTransientError(error) && attemptsLeft > 0) {
        console.warn(
          `[Gemini API] Transient summary error. Retrying in ${delay}ms...`,
        );

        await sleep(delay);
        delay *= 2;
        attemptsLeft -= 1;
        continue;
      }

      throw new Error("SUMMARY_GENERATION_FAILED");
    }
  }
};

const COPILOT_TIMEOUT_MS = 15000;

// Doctor-facing grounded Q&A over a single case record ("RAG" over the case).
// Answers ONLY from the supplied record and refuses to fabricate.
export const answerDoctorQuery = async (context = {}, query = "") => {
  if (!query || typeof query !== "string" || !query.trim()) {
    throw new Error("EMPTY_QUERY");
  }

  const systemInstruction = `
You are MediKiosk Copilot, an assistant for a licensed clinician reviewing a
single patient case. You support the doctor by retrieving and organizing facts
already present in the case record.

The RETRIEVED CASE EXCERPTS below were selected by a retrieval engine as the
passages most relevant to the doctor's question. They may be incomplete.

STRICT RULES:
1. Answer ONLY using the RETRIEVED CASE EXCERPTS. Do not use outside knowledge
   to assert facts about this patient.
2. If the excerpts do not contain the answer, say exactly:
   "This information is not available in the case record."
3. Never diagnose, never prescribe, never recommend a dose.
4. Quote exact values and units when present.
5. Be concise: 1-4 sentences, or a short bulleted list when enumerating.
6. Cite the excerpt's section in brackets, e.g. [Investigations], [HPI],
   [AYUSH], [Red Flags], [Transcript].
7. If the question asks for a clinical decision, surface the relevant recorded
   facts and note that the decision rests with the treating clinician.
`;

  const retrieved = Array.isArray(context.retrieved) ? context.retrieved : [];
  const excerptBlock =
    retrieved.length > 0
      ? retrieved
          .map(
            (chunk, index) =>
              `[${index + 1}] (${chunk.section}) ${chunk.text}`,
          )
          .join("\n\n")
      : "No indexed excerpts were retrieved for this question.";

  const promptContent = `
PATIENT: ${context.patientName || "Unknown"}

RETRIEVED CASE EXCERPTS:
${excerptBlock}

DOCTOR'S QUESTION:
${query}
`;

  const modelsToTry = [PRIMARY_MODEL, FALLBACK_MODEL];

  for (const model of modelsToTry) {
    if (isModelInCooldown(model)) continue;
    try {
      console.log(`[Gemini API] Copilot query using ${model}.`);
      const response = await callGeminiWithTimeout(
        model,
        promptContent,
        {
          systemInstruction,
          thinkingConfig: { thinkingLevel: "medium" },
        },
        COPILOT_TIMEOUT_MS,
      );

      const answer = (response.text || "").trim();
      if (!answer) throw new Error("EMPTY_AI_RESPONSE");

      resetModelHealth(model);
      return answer;
    } catch (error) {
      console.error(
        `[Gemini API] Copilot error on ${model}: ${error?.message || error}`,
      );
      markModelFailure(model);
    }
  }

  throw new Error("COPILOT_UNAVAILABLE");
};
