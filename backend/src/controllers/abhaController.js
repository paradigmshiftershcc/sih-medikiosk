import {
  requestAbhaOtp,
  verifyAbhaOtp,
  getAbhaScaffoldInfo,
} from "../services/abhaAuthService.js";

export const getAbhaStatus = (req, res) => {
  res.status(200).json(getAbhaScaffoldInfo());
};

export const requestOtp = async (req, res) => {
  try {
    const { abhaAddress } = req.body || {};
    const result = await requestAbhaOtp(abhaAddress);
    res.status(200).json(result);
  } catch (error) {
    if (error?.message === "ABHA_ADDRESS_REQUIRED") {
      return res.status(400).json({ message: "abhaAddress is required." });
    }
    if (error?.message === "ABDM_LIVE_NOT_IMPLEMENTED") {
      return res.status(501).json({
        message:
          "Live ABDM integration is not configured. Running in mock mode.",
      });
    }
    console.error("ABHA request OTP error:", error?.message || error);
    res.status(500).json({ message: "Failed to request ABHA OTP." });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { txnId, otp } = req.body || {};
    const result = await verifyAbhaOtp(txnId, otp);
    res.status(200).json(result);
  } catch (error) {
    if (
      error?.message === "TXN_AND_OTP_REQUIRED" ||
      error?.message === "INVALID_OTP"
    ) {
      return res.status(401).json({ message: "Invalid or missing OTP." });
    }
    if (error?.message === "ABDM_LIVE_NOT_IMPLEMENTED") {
      return res.status(501).json({
        message:
          "Live ABDM integration is not configured. Running in mock mode.",
      });
    }
    console.error("ABHA verify OTP error:", error?.message || error);
    res.status(500).json({ message: "Failed to verify ABHA OTP." });
  }
};
