import { GoogleGenAI } from "@google/genai";
import CaseChunk from "../models/CaseChunk.js";

// Hybrid retrieval for the doctor copilot.
//
// Baseline is lexical BM25, which needs no external credentials and always
// works. When GEMINI_API_KEY is present we also embed each chunk and blend
// cosine similarity on top, giving semantic matching for clinical synonyms.
// If embeddings are unavailable we silently fall back to lexical-only.

const EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const EMBED_BATCH_SIZE = 64;
const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "to", "of", "in", "on", "at", "for", "with", "by", "from",
  "as", "it", "its", "this", "that", "these", "those", "i", "you", "he",
  "she", "we", "they", "my", "your", "his", "her", "our", "their", "me",
  "him", "us", "them", "do", "does", "did", "have", "has", "had", "not",
  "no", "yes", "so", "if", "then", "than", "there", "here", "what", "which",
  "who", "when", "where", "how", "any", "some", "about", "patient",
  "assistant", "doctor",
]);

export const tokenize = (text) => {
  const matches = String(text).toLowerCase().match(/[a-z0-9]+/g);
  if (!matches) return [];
  return matches.filter((t) => t.length > 1 && !STOPWORDS.has(t));
};

export const bm25Scores = (queryTerms, chunkTexts) => {
  const n = chunkTexts.length;
  if (n === 0) return [];
  const docTokens = chunkTexts.map((t) => tokenize(t));
  const avgdl =
    docTokens.reduce((sum, tokens) => sum + tokens.length, 0) / n || 1;

  const df = new Map();
  docTokens.forEach((tokens) => {
    new Set(tokens).forEach((term) => df.set(term, (df.get(term) || 0) + 1));
  });

  return docTokens.map((tokens) => {
    const tf = new Map();
    tokens.forEach((term) => tf.set(term, (tf.get(term) || 0) + 1));
    const dl = tokens.length || 1;
    let score = 0;
    queryTerms.forEach((term) => {
      const f = tf.get(term);
      if (!f) return;
      const docFreq = df.get(term) || 0;
      const idf = Math.log(1 + (n - docFreq + 0.5) / (docFreq + 0.5));
      score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + B * (dl / avgdl))));
    });
    return score;
  });
};

const cosine = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const normalize = (values) => {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => v / max);
};

const embedTexts = async (texts) => {
  if (!process.env.GEMINI_API_KEY || texts.length === 0) return null;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const vectors = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
      const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: batch,
      });
      const embeddings =
        response.embeddings || (response.embedding ? [response.embedding] : []);
      embeddings.forEach((e) => vectors.push(e.values));
    }
    return vectors.length === texts.length ? vectors : null;
  } catch (error) {
    console.warn(
      "[Retrieval] Embeddings unavailable, using lexical BM25 only:",
      error?.message || error,
    );
    return null;
  }
};

const push = (chunks, caseId, patientId, section, sourceType, text) => {
  const clean = String(text || "").trim();
  if (!clean) return;
  chunks.push({
    caseId,
    patientId,
    section,
    sourceType,
    text: clean,
    chunkIndex: chunks.length,
  });
};

// Break a case into retrievable chunks across all of its information sources.
export const chunkCase = (caseRecord) => {
  const caseId = caseRecord._id;
  const patientId = caseRecord.patientId?._id || caseRecord.patientId;
  const summary =
    caseRecord.finalSummary?.toObject?.() || caseRecord.finalSummary || {};
  const chunks = [];

  push(chunks, caseId, patientId, "Chief Complaint", "summary", summary.chiefComplaint);
  push(chunks, caseId, patientId, "History of Present Illness", "summary", summary.hpi);

  (summary.pastMedicalHistory || []).forEach((v) =>
    push(chunks, caseId, patientId, "Past Medical History", "summary", `Past medical history: ${v}`),
  );
  (summary.medications || []).forEach((v) =>
    push(chunks, caseId, patientId, "Medications", "summary", `Medication: ${v}`),
  );
  (summary.allergies || []).forEach((v) =>
    push(chunks, caseId, patientId, "Allergies", "summary", `Allergy: ${v}`),
  );
  (summary.documentFindings || []).forEach((v) =>
    push(chunks, caseId, patientId, "Document Findings", "document", v),
  );
  (summary.clinicianAttention || []).forEach((v) =>
    push(chunks, caseId, patientId, "Clinician Attention", "summary", v),
  );
  (summary.missingInformation || []).forEach((v) =>
    push(chunks, caseId, patientId, "Missing Information", "summary", v),
  );

  push(chunks, caseId, patientId, "AYUSH Summary", "ayush", summary.ayushSummary);
  Object.entries(summary.ayushAssessment || {}).forEach(([key, value]) => {
    if (value && value !== "Not assessed") {
      push(chunks, caseId, patientId, "Dashavidha", "ayush", `${key}: ${value}`);
    }
  });

  (caseRecord.redFlags || []).forEach((v) =>
    push(chunks, caseId, patientId, "Red Flag", "redflag", `Red flag: ${v}`),
  );
  (caseRecord.interactionAlerts || []).forEach((v) =>
    push(chunks, caseId, patientId, "Drug Interaction", "interaction", `Drug interaction alert: ${v}`),
  );

  (caseRecord.transcript || []).forEach((message) =>
    push(
      chunks,
      caseId,
      patientId,
      "Transcript",
      "transcript",
      `${message.role === "user" ? "Patient" : "Assistant"}: ${message.content}`,
    ),
  );

  (caseRecord.ocrData?.labValues || []).forEach((lab) => {
    if (!lab?.test) return;
    push(
      chunks,
      caseId,
      patientId,
      "Investigation",
      "document",
      `Lab result: ${lab.test} ${lab.value || ""} ${lab.unit || ""} (reference range ${
        lab.referenceRange || "not stated"
      })`,
    );
  });
  (caseRecord.ocrData?.medicines || []).forEach((med) => {
    if (!med?.name) return;
    push(
      chunks,
      caseId,
      patientId,
      "Document Medication",
      "document",
      `Documented medication: ${med.name}${med.dosage ? ` ${med.dosage}` : ""}`,
    );
  });

  return chunks;
};

// Rebuild the retrieval index for a case. Best-effort; safe to call repeatedly.
export const buildCaseIndex = async (caseRecord) => {
  const chunks = chunkCase(caseRecord);
  await CaseChunk.deleteMany({ caseId: caseRecord._id });
  if (chunks.length === 0) return 0;

  const vectors = await embedTexts(chunks.map((c) => c.text));
  if (vectors) {
    chunks.forEach((chunk, i) => {
      chunk.embedding = vectors[i];
    });
  }

  await CaseChunk.insertMany(chunks);
  return chunks.length;
};

// Retrieve the most relevant chunks for a query using hybrid BM25 + cosine.
export const retrieveRelevantChunks = async (caseRecord, query, k = 6) => {
  let chunks = await CaseChunk.find({ caseId: caseRecord._id }).lean();

  if (chunks.length === 0) {
    await buildCaseIndex(caseRecord);
    chunks = await CaseChunk.find({ caseId: caseRecord._id }).lean();
  }
  if (chunks.length === 0) return [];

  const terms = tokenize(query);
  const lexical = normalize(bm25Scores(terms, chunks.map((c) => c.text)));

  let finalScores = lexical;
  const hasEmbeddings = chunks.every(
    (c) => Array.isArray(c.embedding) && c.embedding.length > 0,
  );
  if (hasEmbeddings) {
    const [queryVector] = (await embedTexts([query])) || [];
    if (queryVector) {
      const semantic = normalize(
        chunks.map((c) => cosine(queryVector, c.embedding)),
      );
      finalScores = chunks.map(
        (_, i) => 0.4 * lexical[i] + 0.6 * semantic[i],
      );
    }
  }

  const ranked = chunks
    .map((chunk, i) => ({
      section: chunk.section,
      sourceType: chunk.sourceType,
      text: chunk.text,
      score: finalScores[i],
    }))
    .sort((a, b) => b.score - a.score)
    .filter((c) => c.score > 0)
    .slice(0, k);

  // If nothing matched, fall back to the summary-level chunks for context.
  if (ranked.length === 0) {
    return chunks
      .filter((c) => c.sourceType === "summary")
      .slice(0, k)
      .map((c) => ({
        section: c.section,
        sourceType: c.sourceType,
        text: c.text,
        score: 0,
      }));
  }

  return ranked;
};
