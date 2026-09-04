import mongoose from "mongoose";

// We store the ongoing chat transcript here.
// In later phases, we will add OCR data and the final summary.
const caseRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    transcript: [
      {
        role: { type: String, enum: ["user", "model"], required: true },
        content: { type: String, required: true },
      },
    ],
    redFlags: [
      { type: String }, // e.g., "Severe Chest Pain", "Breathlessness"
    ],
    ocrData: {
      documentType: { type: String },
      patientName: {
        value: { type: String },
        confidence: { type: String, enum: ["high", "medium", "low"] },
      },
      date: {
        value: { type: String },
        confidence: { type: String, enum: ["high", "medium", "low"] },
      },
      medicines: [
        {
          name: String,
          strength: String,
          dosage: String,
          frequency: String,
          duration: String,
          confidence: { type: String, enum: ["high", "medium", "low"] },
        },
      ],
      labValues: [
        {
          test: String,
          value: String,
          unit: String,
          referenceRange: String,
          confidence: { type: String, enum: ["high", "medium", "low"] },
        },
      ],
      allergies: [String],
      conditions: [String],
      notes: [String],
      unclearItems: [String],
    },
    ayushMode: {
      type: Boolean,
      default: false,
    },
    ayushData: {
      prakriti: String,
      agni: String,
      koshtha: String,
      ahara: String,
      vihara: String,
    },
    finalSummary: {
      type: Object, // Store the structured JSON output from Gemini
      default: null,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "ASSIGNED", "COMPLETED"],
      default: "IN_PROGRESS",
    },
    assignedDoctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    priority: {
      type: String,
      enum: ["ROUTINE", "PRIORITY_REVIEW", "URGENT_REVIEW"],
      default: "ROUTINE",
    },
    assignmentReason: { type: String },
    patientConsentGiven: { type: Boolean, default: true }, // MVP Mock Consent
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("CaseRecord", caseRecordSchema);
