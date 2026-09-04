import jwt from "jsonwebtoken";
import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";

// Generate JWT token
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export const requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ message: "Valid phone number required" });
    }
    // In a real app, integrate Twilio/Msg91 here.
    // For MVP, we just pretend it was sent.
    res
      .status(200)
      .json({ message: "OTP sent successfully (Mock: Use 123456)" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    // Hardcoded MVP OTP check
    if (otp !== "123456") {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Upsert Patient (Find or Create)
    let patient = await Patient.findOne({ phone });

    if (!patient) {
      // Create new patient with a mock ABHA ID
      const randomAbha = `${Math.floor(10 + Math.random() * 90)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`;
      patient = await Patient.create({
        phone,
        abhaId: randomAbha,
        isAbhaLinked: true,
      });
    }

    res.status(200).json({
      _id: patient._id,
      name: patient.name,
      phone: patient.phone,
      abhaId: patient.abhaId,
      isAbhaLinked: patient.isAbhaLinked,
      role: "patient",
      token: generateToken(patient._id, "patient"),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

export const verifyDoctorOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (otp !== "123456") {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const doctor = await Doctor.findOne({ phone });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor profile not found in HPR Mock Registry." });
    }

    res.status(200).json({
      _id: doctor._id,
      name: doctor.name,
      hpId: doctor.hpId,
      specialty: doctor.specialty,
      department: doctor.department,
      role: "doctor",
      token: generateToken(doctor._id, "doctor"),
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};
