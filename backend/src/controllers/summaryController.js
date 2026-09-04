import CaseRecord from "../models/CaseRecord.js";
import { generateClinicalSummary } from "../services/geminiService.js";

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

    // Verify doctor is assigned to this case
    if (
      caseRecord.assignedDoctorId &&
      caseRecord.assignedDoctorId.toString() !== req.user.id
    ) {
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
    });
  } catch (error) {
    console.error("[Summary Controller] Error generating summary:", error);
    res.status(500).json({ message: "Failed to generate clinical summary." });
  }
};
