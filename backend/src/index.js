import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
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

// Fail fast in production if critical auth secret is missing.
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  console.error(
    "FATAL: JWT_SECRET is required in production. Configure it through the deployment platform's environment variables.",
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && !process.env.MONGO_URI) {
  console.error(
    "FATAL: MONGO_URI is required in production. Configure it through the deployment platform's environment variables.",
  );
  process.exit(1);
}

const app = express();

// Trust Render's proxy so req.ip and secure headers work correctly.
app.set("trust proxy", 1);

// Security headers (Helmet: CSP, X-Frame-Options, HSTS, etc.).
// The API does not serve HTML or accept cross-origin navigation, so the
// defaults are compatible with audio/image payloads and JSON responses.
app.use(helmet());

// CORS allowlist: configure FRONTEND_URL (comma-separated) for deployed
// frontends. Localhost stays allowed for local development, and *.vercel.app
// origins are accepted so Vercel preview deployments keep working.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const LOCALHOST_PATTERN = /^https?:\/\/localhost(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (curl, health checks, server-to-server).
      if (!origin) return callback(null, true);
      // Allow local development.
      if (LOCALHOST_PATTERN.test(origin)) return callback(null, true);
      // Allow Vercel preview deployments.
      if (origin.endsWith(".vercel.app")) return callback(null, true);
      // Allow explicitly configured production frontend origins.
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

// Explicit body size limits. The MVP sends Base64 document images (max ~5MB)
// and Base64 audio clips, so 10mb is the documented ceiling for both JSON
// and urlencoded payloads.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Health Check Route.
// Reports process liveness and database readiness without exposing any
// connection details, credentials, or internal paths.
app.get("/api/health", (req, res) => {
  const dbReady =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  const status = dbReady === "connected" ? "ok" : "degraded";
  res.status(200).json({
    status,
    message: "MediKiosk API is running!",
    database: dbReady,
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'MediKiosk API',
    status: 'ok'
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/intake", intakeRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/summary", summaryRoutes);
app.use("/api/doctor", doctorRoutes);

// 404 for unknown API routes
app.use((req, res) => {
  res.status(404).json({ message: "Not found" });
});

// Central error handler: never leak stack traces, paths, or provider payloads.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ message: "Malformed JSON body" });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ message: "Payload too large" });
  }
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "Not allowed by CORS" });
  }
  console.error("Unhandled error:", err?.message || err);
  return res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Serve only after the database is connected so Render does not report
    // the service as ready while the app cannot operate.
    await connectDB();

    app.listen(PORT, () => {
      const mode = process.env.NODE_ENV || "development";
      console.log(`Server running in ${mode} mode on port ${PORT}`);

      // Seed Mock Doctors for Demo if DB is empty
      Doctor.countDocuments()
        .then(async (docCount) => {
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
        })
        .catch((err) => {
          console.error("Failed to seed doctors:", err?.message || err);
        });
    });
  } catch (error) {
    console.error("Server failed to start:", error?.message || error);
    process.exit(1);
  }
};

startServer();