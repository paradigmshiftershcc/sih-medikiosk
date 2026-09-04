import express from "express";
import {
  processChatTurn,
  saveAyushData,
  getPatientHistory,
  completeCaseAndAssign,
} from "../controllers/intakeController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/chat", protect, authorize("patient"), processChatTurn);
router.put("/ayush/:caseId", protect, authorize("patient"), saveAyushData);
router.get("/history", protect, authorize("patient"), getPatientHistory);
router.post(
  "/:caseId/complete",
  protect,
  authorize("patient"),
  completeCaseAndAssign,
);

export default router;
