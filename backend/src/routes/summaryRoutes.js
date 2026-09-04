import express from "express";
import { getCaseSummary } from "../controllers/summaryController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Only doctors can fetch the detailed summary (Patients see limited history on dashboard)
router.get("/:caseId", protect, authorize("doctor"), getCaseSummary);

export default router;
