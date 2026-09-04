import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import intakeRoutes from "./routes/intakeRoutes.js";
import ocrRoutes from "./routes/ocrRoutes.js";
import summaryRoutes from "./routes/summaryRoutes.js";
import doctorRoutes from "./routes/doctorRoutes.js";
import Doctor from "./models/Doctor.js";

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
// INCREASE LIMIT FOR BASE64 IMAGE PAYLOADS (~10MB)
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Basic Health Check Route
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok", message: "MediKiosk API is running!" });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/doctor", doctorRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log(`Server running in development mode on port ${PORT}`);

  // Seed Mock Doctors for Demo if DB is empty
  try {
    const docCount = await Doctor.countDocuments();
    if (docCount === 0) {
      await Doctor.insertMany([
        {
          phone: "1111111111",
          name: "Dr. Aisha Sharma",
          hpId: "HP-1001",
          specialty: "General Medicine",
          department: "Internal Medicine",
          languages: ["English", "Hindi"],
        },
        {
          phone: "2222222222",
          name: "Dr. Rajesh Patel",
          hpId: "HP-1002",
          specialty: "Ayurveda",
          department: "AYUSH",
          systemOfMedicine: "Ayurveda",
          languages: ["Hindi", "Gujarati"],
        },
        {
          phone: "3333333333",
          name: "Dr. Sneha Gupta",
          hpId: "HP-1003",
          specialty: "Cardiology",
          department: "Cardiology",
          languages: ["English", "Hindi", "Marathi"],
        },
        {
          phone: "4444444444",
          name: "Dr. Vikram Singh",
          hpId: "HP-1004",
          specialty: "Dermatology",
          department: "Dermatology",
          languages: ["Hindi", "English", "Punjabi"],
        },
        {
          phone: "5555555555",
          name: "Dr. Priya Nair",
          hpId: "HP-1005",
          specialty: "Orthopedics",
          department: "Orthopedics",
          languages: ["Malayalam", "English", "Tamil"],
        },
      ]);
      console.log("Seeded Mock HPR Doctors.");
    }
  } catch (err) {
    console.error("Failed to seed doctors:", err);
  }
});
