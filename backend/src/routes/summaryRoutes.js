import express from "express";
import {
  getCaseSummary,
  updateCaseSummary,
  verifyCaseSummary,
  askCopilot,
} from "../controllers/summaryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only doctors can fetch the detailed summary (Patients see limited history on dashboard)
router.get("/:caseId", protect, authorize("doctor"), getCaseSummary);

// Doctor edits and verification of the AI-generated summary.
router.put("/:caseId", protect, authorize("doctor"), updateCaseSummary);
router.put("/:caseId/verify", protect, authorize("doctor"), verifyCaseSummary);

// Grounded copilot Q&A over a single case.
router.post("/:caseId/copilot", protect, authorize("doctor"), askCopilot);

export default router;
