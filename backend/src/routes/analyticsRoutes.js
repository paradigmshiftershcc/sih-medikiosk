import express from "express";
import {
  getMetrics,
  getTrends,
  getTimeline,
} from "../controllers/analyticsController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// Patient-scoped: the authenticated patient's own records.
router.get("/me/metrics", protect, authorize("patient"), getMetrics);
router.get("/me/trends", protect, authorize("patient"), getTrends);
router.get("/me/timeline", protect, authorize("patient"), getTimeline);

// Doctor-scoped: records for a case assigned to the authenticated doctor.
router.get("/case/:caseId/metrics", protect, authorize("doctor"), getMetrics);
router.get("/case/:caseId/trends", protect, authorize("doctor"), getTrends);
router.get("/case/:caseId/timeline", protect, authorize("doctor"), getTimeline);

export default router;
