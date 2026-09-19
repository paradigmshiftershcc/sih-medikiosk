import express from "express";
import {
  getAbhaStatus,
  requestOtp,
  verifyOtp,
} from "../controllers/abhaController.js";

const router = express.Router();

// ABHA/ABDM authentication scaffold. Public by design (pre-login), and falls
// back to mock mode when ABDM credentials are not configured.
router.get("/status", getAbhaStatus);
router.post("/request-otp", requestOtp);
router.post("/verify-otp", verifyOtp);

export default router;
