import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      default: 'Guest Patient', // Default name until they update their profile
    },
    abhaId: {
      type: String,
      // Mock 14-digit ABHA format: XX-XXXX-XXXX-XXXX
    },
    isAbhaLinked: {
      type: Boolean,
      default: false,
    }
  },
  { timestamps: true }
);

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;