import express from "express";
import { getDoctorQueue } from "../controllers/doctorController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/queue", protect, authorize("doctor"), getDoctorQueue);

export default router;
