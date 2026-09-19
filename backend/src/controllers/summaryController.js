import CaseRecord from "../models/CaseRecord.js";
import {
  generateClinicalSummary,
  answerDoctorQuery,
} from "../services/geminiService.js";
import { retrieveRelevantChunks } from "../services/retrievalService.js";

const EDITABLE_SUMMARY_KEYS = [
  "chiefComplaint",
  "hpi",
  "pastMedicalHistory",
  "medications",
  "allergies",
  "redFlags",
  "ayushSummary",
  "ayushAssessment",
  "documentFindings",
  "missingInformation",
  "clinicianAttention",
];

// Load a case and confirm the requesting doctor is the assignee.
const loadAssignedCase = async (caseId, doctorId) => {
  const caseRecord = await CaseRecord.findById(caseId);
  if (!caseRecord) return { error: { status: 404, message: "Case not found" } };
  if (caseRecord.assignedDoctorId?.toString() !== doctorId) {
    return {
      error: { status: 403, message: "You are not assigned to this case." },
    };
  }
  return { caseRecord };
};

const applySummaryEdits = (caseRecord, edits = {}) => {
  const merged = { ...(caseRecord.finalSummary?.toObject?.() || caseRecord.finalSummary || {}) };
  EDITABLE_SUMMARY_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(edits, key)) {
      merged[key] = edits[key];
    }
  });
  caseRecord.finalSummary = merged;
  return merged;
};

export const getCaseSummary = async (req, res) => {
  try {
    const { caseId } = req.params;

    // We populate patientId to get the demographic details (Name, ABHA)
    const caseRecord = await CaseRecord.findById(caseId).populate(
      "patientId",
      "name abhaId",
    );

    if (!caseRecord) {
      return res.status(404).json({ message: "Case not found" });
    }

    // Verify doctor is assigned to this case.
    // An unassigned or differently-assigned case is not visible to this doctor.
    if (caseRecord.assignedDoctorId?.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You are not assigned to this case." });
    }

    // If summary hasn't been generated yet, generate and save it
    if (!caseRecord.finalSummary) {
      console.log(
        `[Summary Controller] No existing summary found. Generating for case ${caseId}...`,
      );
      const summary = await generateClinicalSummary(caseRecord);
      caseRecord.finalSummary = summary;
      await caseRecord.save();
    }

    // Return the complete payload needed for the Doctor View
    res.status(200).json({
      caseId: caseRecord._id,
      patient: caseRecord.patientId,
      summary: caseRecord.finalSummary,
      redFlags: caseRecord.redFlags,
      ayushMode: caseRecord.ayushMode,
      ocrData: caseRecord.ocrData,
      ayushData: caseRecord.ayushData,
      priority: caseRecord.priority,
      assignmentReason: caseRecord.assignmentReason,
      interactionAlerts: caseRecord.interactionAlerts || [],
      informant: caseRecord.informant,
      status: caseRecord.status,
      verifiedBy: caseRecord.verifiedBy,
      verifiedAt: caseRecord.verifiedAt,
    });
  } catch (error) {
    console.error(
      "[Summary Controller] Summary generation failed:",
      error?.message || error,
    );
    res.status(500).json({ message: "Failed to generate clinical summary." });
  }
};

// Doctor saves edits to the AI summary without verifying.
export const updateCaseSummary = async (req, res) => {
  try {
    const { caseRecord, error } = await loadAssignedCase(
      req.params.caseId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ message: error.message });

    if (!caseRecord.finalSummary) {
      return res
        .status(400)
        .json({ message: "No summary exists for this case yet." });
    }

    const merged = applySummaryEdits(caseRecord, req.body?.summary || {});
    await caseRecord.save();

    res.status(200).json({ message: "Summary saved.", summary: merged });
  } catch (error) {
    console.error("Update Summary Error:", error?.message || error);
    res.status(500).json({ message: "Failed to save summary." });
  }
};

// Doctor accepts the (possibly edited) summary as the verified record.
export const verifyCaseSummary = async (req, res) => {
  try {
    const { caseRecord, error } = await loadAssignedCase(
      req.params.caseId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ message: error.message });

    if (!caseRecord.finalSummary) {
      return res
        .status(400)
        .json({ message: "No summary exists for this case to verify." });
    }

    if (req.body?.summary) {
      applySummaryEdits(caseRecord, req.body.summary);
    }

    caseRecord.status = "VERIFIED";
    caseRecord.verifiedBy = req.user.id;
    caseRecord.verifiedAt = new Date();
    await caseRecord.save();

    res.status(200).json({
      message: "Summary verified and accepted.",
      status: caseRecord.status,
      verifiedAt: caseRecord.verifiedAt,
      summary: caseRecord.finalSummary,
    });
  } catch (error) {
    console.error("Verify Summary Error:", error?.message || error);
    res.status(500).json({ message: "Failed to verify summary." });
  }
};

// Grounded Q&A over this case record for the assigned doctor.
export const askCopilot = async (req, res) => {
  try {
    const { caseRecord, error } = await loadAssignedCase(
      req.params.caseId,
      req.user.id,
    );
    if (error) return res.status(error.status).json({ message: error.message });

    const { query } = req.body || {};
    if (!query || !query.trim()) {
      return res.status(400).json({ message: "query is required." });
    }

    // Retrieve only the passages most relevant to the question (RAG), instead
    // of passing the entire case to the model.
    const retrieved = await retrieveRelevantChunks(
      caseRecord,
      query.trim(),
      6,
    );

    const answer = await answerDoctorQuery({ retrieved }, query.trim());

    res.status(200).json({ answer, sources: retrieved.length });
  } catch (error) {
    console.error("Copilot Error:", error?.message || error);
    res
      .status(503)
      .json({ message: "Copilot is temporarily unavailable. Please retry." });
  }
};
