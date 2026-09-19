import crypto from "crypto";

// ABDM / ABHA authentication scaffold.
//
// ABDM's production flow requires a registered client (client id + secret), a
// session access token, and an RSA-encrypted OTP channel. None of those
// credentials are bundled with this repo, so every function degrades to a
// deterministic mock that keeps the UI flow testable. Implementations that
// need live ABDM should set ABDM_CLIENT_ID / ABDM_CLIENT_SECRET.

const ABDM_BASE_URL = process.env.ABDM_BASE_URL || "https://sandbox.abdm.gov.in";

export const hasLiveAbdmCredentials = () =>
  Boolean(process.env.ABDM_CLIENT_ID && process.env.ABDM_CLIENT_SECRET);

// RSA-2048 keypair used for the ABDM encryption handshake.
export const generateRsaKeyPair = () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
};

const OAEP_OPTIONS = (key) => ({
  key,
  padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: "sha256",
});

export const encryptWithPublicKey = (plaintext, publicKeyPem) =>
  crypto
    .publicEncrypt(OAEP_OPTIONS(publicKeyPem), Buffer.from(String(plaintext)))
    .toString("base64");

export const decryptWithPrivateKey = (cipherBase64, privateKeyPem) =>
  crypto
    .privateDecrypt(
      OAEP_OPTIONS(privateKeyPem),
      Buffer.from(cipherBase64, "base64"),
    )
    .toString("utf8");

// Step 1: request an OTP for an ABHA address / Aadhaar or mobile.
export const requestAbhaOtp = async (abhaAddress) => {
  if (!abhaAddress) throw new Error("ABHA_ADDRESS_REQUIRED");

  if (!hasLiveAbdmCredentials()) {
    return {
      txnId: `mock-txn-${crypto.randomUUID()}`,
      abhaAddress,
      live: false,
      hint: "Mock mode: use OTP 123456.",
    };
  }

  // Live path (scaffold): obtain a session token, then initiate auth.
  // 1) POST ${ABDM_BASE_URL}/v0.5/sessions  { clientId, clientSecret }
  // 2) POST /v1/auth/init with the RSA-encrypted OTP channel
  throw new Error("ABDM_LIVE_NOT_IMPLEMENTED");
};

// Step 2: verify the OTP and return the linked ABHA identifier.
export const verifyAbhaOtp = async (txnId, otp) => {
  if (!txnId || !otp) throw new Error("TXN_AND_OTP_REQUIRED");

  if (!hasLiveAbdmCredentials()) {
    if (String(otp) !== "123456") throw new Error("INVALID_OTP");
    return {
      abhaId: `mock-${txnId.replace(/^mock-txn-/, "").slice(0, 12)}@abdm`,
      txnId,
      live: false,
    };
  }

  // Live path (scaffold): POST /v1/auth/confirm with txnId + OTP inside the
  // encrypted payload, then map the returned ABHA profile.
  throw new Error("ABDM_LIVE_NOT_IMPLEMENTED");
};

export const getAbhaScaffoldInfo = () => ({
  live: hasLiveAbdmCredentials(),
  baseUrl: ABDM_BASE_URL,
  encryption: "RSA-OAEP-SHA256",
  note: "Set ABDM_CLIENT_ID and ABDM_CLIENT_SECRET to enable the live ABDM path.",
});
