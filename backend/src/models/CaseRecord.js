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
    language: {
      type: String,
      default: "en", // ISO-639 consultation language (e.g. 'hi', 'en')
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
      default: true,
    },
    ayushData: {
      // Dashavidha Pariksha (Rogi Pariksha - patient terrain assessment)
      prakriti: String, // Constitution (Vata / Pitta / Kapha / Mixed)
      vikriti: String, // Current imbalance
      sara: String, // Tissue vitality / excellence
      samhanana: String, // Body frame / compactness
      pramana: String, // Anthropometric proportion
      satmya: String, // Habituation / tolerance (food & climate)
      sattva: String, // Mental strength / emotional stability
      aharaShakti: {
        abhyavaharanaShakti: String, // Appetite / food intake capacity
        jaranaShakti: String, // Digestion / assimilation capacity after meals
      },
      vyayamaShakti: String, // Physical endurance
      vaya: String, // Life stage (Bala / Madhyama / Vriddha)
      agni: String, // Digestive fire (Sama / Vishama / Tikshna / Manda)
      koshtha: String, // Bowel nature (Krura / Mridu / Madhya)
      ashtavidha: {
        jihva: String, // Tongue examination cue
        nidra: String, // Sleep quality
        mutraMala: String, // Urine & stool cues
      },
      nidana: {
        aharaHetu: String, // Dietary causative factors
        viharaHetu: String, // Lifestyle causative factors
        manasikaHetu: String, // Mental / emotional causative factors
      },
    },
    finalSummary: {
      type: Object, // Store the structured JSON output from Gemini
      default: null,
    },
    status: {
      type: String,
      enum: ["IN_PROGRESS", "ASSIGNED", "COMPLETED", "VERIFIED"],
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
    consentAt: { type: Date, default: null },
    // Who provided the history: the patient or an accompanying person.
    informant: {
      type: {
        type: String,
        enum: ["self", "companion"],
        default: "self",
      },
      relationship: { type: String, default: "" },
    },
    // Drug-drug interactions detected across the patient's medication list.
    interactionAlerts: [{ type: String }],
    // Physician verification of the AI-generated summary.
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      default: null,
    },
    verifiedAt: { type: Date, default: null },
    assignedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export default mongoose.model("CaseRecord", caseRecordSchema);
