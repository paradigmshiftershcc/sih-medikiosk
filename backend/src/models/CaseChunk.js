import mongoose from "mongoose";

// A single retrievable unit of a case record. Chunks are created when a case
// is summarized and embedded (when an embedding model is available). The RAG
// copilot retrieves the top chunks for a query instead of passing the whole
// case to the model.
const caseChunkSchema = new mongoose.Schema(
  {
    caseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CaseRecord",
      required: true,
      index: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
      index: true,
    },
    section: { type: String, required: true },
    sourceType: {
      type: String,
      enum: [
        "transcript",
        "summary",
        "document",
        "ayush",
        "redflag",
        "interaction",
      ],
      required: true,
    },
    text: { type: String, required: true },
    chunkIndex: { type: Number, default: 0 },
    embedding: { type: [Number], default: undefined },
  },
  { timestamps: true },
);

caseChunkSchema.index({ caseId: 1, chunkIndex: 1 });

export default mongoose.model("CaseChunk", caseChunkSchema);
