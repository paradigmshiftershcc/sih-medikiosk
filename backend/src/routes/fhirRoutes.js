import express from "express";
import { getOPConsultationBundle } from "../controllers/fhirController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Export a case as a FHIR R4 OPConsultation document bundle.
// Access is enforced in the controller (assigned doctor or owning patient).
router.get(
  "/case/:caseId/OPConsultation",
  protect,
  authorize("doctor", "patient"),
  getOPConsultationBundle,
);

export default router;
