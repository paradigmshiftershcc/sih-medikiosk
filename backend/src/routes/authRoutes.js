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

export default router;
