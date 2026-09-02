import mongoose from 'mongoose';

// We store the ongoing chat transcript here. 
// In later phases, we will add OCR data and the final summary.
const caseRecordSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    transcript: [
      {
        role: { type: String, enum: ['user', 'model'], required: true },
        content: { type: String, required: true },
      }
    ],
    redFlags: [
      { type: String } // e.g., "Severe Chest Pain", "Breathlessness"
    ],
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
    }
  },
  { timestamps: true }
);

export default mongoose.model('CaseRecord', caseRecordSchema);