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
    ocrData: {
      documentType: { type: String },
      patientName: {
        value: { type: String },
        confidence: { type: String, enum: ['high', 'medium', 'low'] }
      },
      date: {
        value: { type: String },
        confidence: { type: String, enum: ['high', 'medium', 'low'] }
      },
      medicines: [{
        name: String,
        strength: String,
        dosage: String,
        frequency: String,
        duration: String,
        confidence: { type: String, enum: ['high', 'medium', 'low'] }
      }],
      labValues: [{
        test: String,
        value: String,
        unit: String,
        referenceRange: String,
        confidence: { type: String, enum: ['high', 'medium', 'low'] }
      }],
      allergies: [String],
      conditions: [String],
      notes: [String],
      unclearItems: [String]
    },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED'],
      default: 'IN_PROGRESS',
    }
  },
  { timestamps: true }
);

export default mongoose.model('CaseRecord', caseRecordSchema);