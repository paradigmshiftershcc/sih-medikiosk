import express from "express";
import {
  createSupportCase,
  listMyCases,
  getSupportCase,
  chatTurn,
  transcribeVoiceInCase,
  assessCase,
  submitCase,
  updateCaseStatus,
  updateCaseAssignment,
  updateCaseMeta,
} from "../controllers/supportCaseController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Complainant routes
router.post("/", protect, authorize("patient"), createSupportCase);
router.get("/", protect, authorize("patient"), listMyCases);
// Both complainants (own case) and support officers may read a case.
router.get("/:caseId", protect, getSupportCase);
router.post("/:caseId/chat", protect, authorize("patient"), chatTurn);
router.post("/:caseId/transcribe", protect, authorize("patient"), transcribeVoiceInCase);
router.post("/:caseId/assess", protect, authorize("patient"), assessCase);
router.post("/:caseId/submit", protect, authorize("patient"), submitCase);

// Officer routes
router.patch("/:caseId/status", protect, authorize("doctor"), updateCaseStatus);
router.patch("/:caseId/assignment", protect, authorize("doctor"), updateCaseAssignment);
router.patch("/:caseId/meta", protect, authorize("doctor"), updateCaseMeta);

export default router;