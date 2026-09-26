import mongoose from "mongoose";

// Sahaay — SIH26093 Stress & Trauma Assessment support case.
// One case per complainant intake session. No medical fields, no audio
// blob persistence, no sensitive transcription logs.
const supportCaseSchema = new mongoose.Schema(
  {
    complainantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    language: {
      type: String,
      default: "en", // intake language ('en','hi','mr','gu','bn','auto')
    },
    consent: {
      granted: { type: Boolean, default: false },
      timestamp: { type: Date, default: null },
      // Granular consent scopes (plain-language items on the consent screen).
      scopes: {
        intakeProcessing: { type: Boolean, default: false },
        voiceTranscription: { type: Boolean, default: false },
        aiAnalysis: { type: Boolean, default: false },
        storage: { type: Boolean, default: false },
      },
      voiceNoticeAcknowledged: { type: Boolean, default: false },
    },
    // NHAA assessment-layer metadata. Optional; never used for scoring.
    sourceChannel: {
      type: String,
      enum: ["VOICE_CALL", "WEB_PORTAL", "CHATBOT", "MOBILE_APP", "IVRS", "OTHER"],
      default: "WEB_PORTAL",
    },
    externalReference: {
      docketNumber: { type: String, default: "" },
    },
    incidentType: {
      type: String,
      enum: [
        "CASTE_DISCRIMINATION",
        "PHYSICAL_VIOLENCE",
        "SEXUAL_VIOLENCE",
        "THREAT_INTIMIDATION",
        "SOCIAL_BOYCOTT",
        "DISPLACEMENT",
        "FAMILY_DEATH",
        "LEGAL_PROCEEDING_DISTRESS",
        "OTHER",
        "UNKNOWN",
      ],
      default: "UNKNOWN",
    },
    immediateSafety: {
      type: String,
      enum: ["SAFE", "UNSAFE", "UNKNOWN"],
      default: "UNKNOWN",
    },
    supportNeeds: [
      {
        type: String,
        enum: [
          "COUNSELLING",
          "LEGAL_AID",
          "MEDICAL",
          "POLICE_REVIEW",
          "PROTECTION_REVIEW",
          "SHELTER_REHABILITATION",
          "EMERGENCY_SUPPORT",
          "HUMAN_REVIEW",
        ],
      },
    ],
    transcript: [
      {
        role: { type: String, enum: ["user", "model"], required: true },
        content: { type: String, required: true },
        source: { type: String, enum: ["text", "voice"], default: "text" },
      },
    ],
    incident: {
      narrative: { type: String, default: "" },
      category: { type: String, default: "" },
    },
    // Evidence-backed vulnerability signals extracted by the AI layer and
    // reviewed by the deterministic SVI engine. Never an AI-computed score.
    vulnerabilitySignals: {
      immediateDanger: { type: Boolean, default: false },
      reportedThreats: { type: Boolean, default: false },
      severeFear: { type: Boolean, default: false },
      severeDistress: { type: Boolean, default: false },
      intimidation: { type: Boolean, default: false },
      socialIsolation: { type: Boolean, default: false },
      supportNetworkUnavailable: { type: Boolean, default: false },
      displacement: { type: Boolean, default: false },
      selfHarmStatement: { type: Boolean, default: false },
      medicalConcern: { type: Boolean, default: false },
      legalAssistanceRequested: { type: Boolean, default: false },
    },
    safetyIndicators: [{ type: String }],
    evidence: [
      {
        signal: { type: String },
        evidence: { type: String },
      },
    ],
    assessment: {
      svi: {
        score: { type: Number },
        riskLevel: {
          type: String,
          enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
        },
        band: {
          type: String,
          enum: ["LOW", "MODERATE", "HIGH", "CRITICAL"],
        },
        factors: [
          {
            signal: String,
            factor: String,
            label: String,
            weight: Number,
            points: Number,
            source: String,
            evidence: String,
          },
        ],
        disclaimer: { type: String },
        computedAt: { type: Date },
        forcedCritical: { type: Boolean, default: false },
        engineVersion: { type: String, default: "svi-prototype-v1" },
      },
      recommendations: [
        {
          code: String,
          pathway: String,
          reason: String,
          rationale: String,
          triggerEvidence: [String],
          priority: Number,
          humanReviewRequired: { type: Boolean, default: true },
        },
      ],
    },
    // Per-turn assessment evolution: one compact snapshot per answered turn.
    // Powers the officer "Assessment Replay" (Turn N -> SVI).
    assessmentHistory: [
      {
        at: { type: Date, default: Date.now },
        turn: { type: Number },
        score: { type: Number },
        riskLevel: { type: String },
        newSignals: [String],
        voiceAvailable: { type: Boolean, default: false },
      },
    ],
    // Derived voice/speech indicators (features + observations ONLY).
    // RAW_AUDIO_RETENTION = 0: raw recordings are never persisted.
    voiceAnalytics: {
      features: { type: Object, default: null },
      observations: [
        {
          type: String,
          severity: String,
          source: String,
          evidence: String,
          confidence: Number,
        },
      ],
      affectObservations: [
        {
          label: String,
          confidence: Number,
          evidence: String,
        },
      ],
      affectDisclaimer: { type: String, default: "" },
      source: { type: String, default: "" },
      updatedAt: { type: Date, default: null },
    },
    urgentFlag: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["NEW", "IN_REVIEW", "ESCALATED", "ASSIGNED", "RESOLVED", "CLOSED"],
      default: "NEW",
    },
    assignedOfficerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    // Human-review timeline: every status/assignment change by an officer.
    events: [
      {
        status: { type: String },
        officerName: { type: String },
        note: { type: String },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

// Active queue support index: submitted + not resolved/closed, newest first.
supportCaseSchema.index({
  submittedAt: 1,
  status: 1,
  createdAt: -1,
});

export default mongoose.model("SupportCase", supportCaseSchema);