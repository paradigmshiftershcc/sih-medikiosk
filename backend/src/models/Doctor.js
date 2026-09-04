import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    hpId: { type: String, required: true }, // Healthcare Professional ID (HPR mock)
    specialty: { type: String, required: true },
    department: { type: String, required: true },
    systemOfMedicine: { type: String, default: 'Allopathy' },
    languages: [{ type: String }],
    facility: { type: String, default: 'Govt General Hospital' },
  },
  { timestamps: true }
);

export default mongoose.model('Doctor', doctorSchema);