import CaseRecord from "../models/CaseRecord.js";
import Observation from "../models/Observation.js";
import { buildOPConsultationBundle } from "../services/fhirService.js";

// GET /api/fhir/case/:caseId/OPConsultation
// Doctor (assigned) or the owning patient can export the FHIR bundle.
export const getOPConsultationBundle = async (req, res) => {
  try {
    const { caseId } = req.params;

    const caseRecord = await CaseRecord.findById(caseId)
      .populate("patientId", "name abhaId phone")
      .populate("assignedDoctorId", "name hpId specialty department");

    if (!caseRecord) {
      return res.status(404).json({ message: "Case not found." });
    }

    const patientId = caseRecord.patientId?._id?.toString();
    const isOwner = patientId === req.user.id;
    const isAssignedDoctor =
      caseRecord.assignedDoctorId?._id?.toString() === req.user.id;

    if (!isOwner && !isAssignedDoctor) {
      return res.status(403).json({ message: "Access denied to this case." });
    }

    const observations = await Observation.find({ caseId }).sort({
      observationDate: 1,
    });

    const bundle = buildOPConsultationBundle({
      caseRecord,
      patient: caseRecord.patientId,
      doctor: caseRecord.assignedDoctorId,
      observations,
    });

    res.type("application/fhir+json");
    res.status(200).json(bundle);
  } catch (error) {
    console.error("FHIR Export Error:", error?.message || error);
    res.status(500).json({ message: "Failed to build FHIR bundle." });
  }
};
