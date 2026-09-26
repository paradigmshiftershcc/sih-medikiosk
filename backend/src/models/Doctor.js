import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    hpId: { type: String, required: true }, // Officer registry ID (mock)
    specialty: { type: String, required: true },
    department: { type: String, required: true },
    systemOfMedicine: { type: String, default: 'N/A' }, // legacy-compat field, unused by Sahaay
    languages: [{ type: String }],
    facility: { type: String, default: 'NHAA Support Center' },
  },
  { timestamps: true }
);

export default mongoose.model('Doctor', doctorSchema);