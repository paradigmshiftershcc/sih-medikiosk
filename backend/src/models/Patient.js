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
      default: 'Guest Complainant', // Default name until they update their profile
    },
    abhaId: {
      type: String,
      // Legacy-compat mock identifier (format XX-XXXX-XXXX-XXXX); unused by Sahaay UI
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