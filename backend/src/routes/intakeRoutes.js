import express from "express";
import {
  processChatTurn,
  transcribeVoice,
  saveAyushData,
  previewCaseReview,
  getPatientHistory,
  completeCaseAndAssign,
} from "../controllers/intakeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/chat", protect, authorize("patient"), processChatTurn);
// Transcription-only endpoint: returns text for patient review, no DB writes.
router.post("/transcribe", protect, authorize("patient"), transcribeVoice);
router.put("/ayush/:caseId", protect, authorize("patient"), saveAyushData);
router.get("/:caseId/review", protect, authorize("patient"), previewCaseReview);
router.get("/history", protect, authorize("patient"), getPatientHistory);
router.post(
  "/:caseId/complete",
  protect,
  authorize("patient"),
  completeCaseAndAssign,
);

export default router;
