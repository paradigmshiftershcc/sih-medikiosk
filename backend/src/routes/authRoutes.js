import express from "express";
import {
  requestOtp,
  verifyOtp,
  verifyDoctorOtp,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);
router.post("/verify-doctor-otp", verifyDoctorOtp);
// Product-facing alias for the same officer authentication (mock registry).
router.post("/verify-officer-otp", verifyDoctorOtp);

export default router;
