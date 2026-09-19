import mongoose from "mongoose";

// Atomized clinical observations extracted from uploaded documents.
// One document per lab metric, so trends and filters run as simple
// indexed queries instead of re-parsing the original report.
const observationSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseRecord",
      required: true,
      index: true,
    },
    metricCode: { type: String, required: true, index: true },
    metricName: { type: String, required: true },
    value: { type: Number, required: true },
    unit: { type: String, default: "" },
    referenceRange: { type: String, default: "" },
    isAbnormal: { type: Boolean, default: false },
    observationDate: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Compound index for fast per-patient, per-metric trend queries.
observationSchema.index({ patientId: 1, metricCode: 1, observationDate: -1 });

export default mongoose.model("Observation", observationSchema);
