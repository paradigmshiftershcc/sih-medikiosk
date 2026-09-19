import Observation from "../models/Observation.js";

// Normalize a lab test name into a stable metric code.
export const toMetricCode = (name = "") =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);

const parseNumber = (raw) => {
  if (raw === null || raw === undefined) return null;
  const match = String(raw).match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
};

// Parse reference ranges like "70-100", "1.5 - 4.5", "<200", ">40".
// Returns { low, high } where either bound may be null.
export const parseReferenceRange = (range) => {
  if (!range) return { low: null, high: null };
  const text = String(range).replace(/,/g, "");

  const between = text.match(/(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)/);
  if (between) {
    const a = Number(between[1]);
    const b = Number(between[2]);
    return { low: Math.min(a, b), high: Math.max(a, b) };
  }

  const lessThan = text.match(/[<≤]\s*(-?\d+(?:\.\d+)?)/);
  if (lessThan) return { low: null, high: Number(lessThan[1]) };

  const greaterThan = text.match(/[>≥]\s*(-?\d+(?:\.\d+)?)/);
  if (greaterThan) return { low: Number(greaterThan[1]), high: null };

  return { low: null, high: null };
};

export const isValueAbnormal = (value, range) => {
  const numeric = parseNumber(value);
  if (numeric === null) return false;
  const { low, high } = parseReferenceRange(range);
  if (low === null && high === null) return false;
  if (low !== null && numeric < low) return true;
  if (high !== null && numeric > high) return true;
  return false;
};

const parseObservationDate = (raw, fallback) => {
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback || new Date();
};

// Convert the OCR labValues for a case into indexed Observation documents.
// Re-running for the same case replaces its previous observations.
export const atomizeObservations = async (caseRecord) => {
  const labValues = Array.isArray(caseRecord?.ocrData?.labValues)
    ? caseRecord.ocrData.labValues
    : [];

  await Observation.deleteMany({ caseId: caseRecord._id });

  const fallbackDate = caseRecord.createdAt || new Date();
  const observationDate = parseObservationDate(
    caseRecord?.ocrData?.date?.value,
    fallbackDate,
  );

  const docs = labValues
    .map((lab) => {
      const value = parseNumber(lab?.value);
      if (value === null || !lab?.test) return null;
      const referenceRange = lab?.referenceRange || "";
      return {
        patientId: caseRecord.patientId,
        caseId: caseRecord._id,
        metricCode: toMetricCode(lab.test),
        metricName: String(lab.test).trim(),
        value,
        unit: lab?.unit || "",
        referenceRange,
        isAbnormal: isValueAbnormal(value, referenceRange),
        observationDate,
      };
    })
    .filter(Boolean);

  if (docs.length > 0) {
    await Observation.insertMany(docs);
  }

  return docs.length;
};
