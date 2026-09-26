import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import Doctor from "./models/Doctor.js";
import { protect, authorize } from "./middleware/authMiddleware.js";
import { getSupportQueue } from "./controllers/supportCaseController.js";
import { seedSupportDemoData } from "./config/seedSupportData.js";

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

// Explicit body size limits. The kiosk sends Base64 voice clips for
// transcription, so 10mb is the documented ceiling for both JSON and
// urlencoded payloads.
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
    message: "Sahaay API is running!",
    database: dbReady,
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'Sahaay API',
    status: 'ok'
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/cases", supportRoutes);
app.get("/api/queue", protect, authorize("doctor"), getSupportQueue);

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

      // Seed support officers (mock officer registry) for the demo. Internal
      // model/role names are retained for engine compatibility; the visible
      // product language is officer/counsellor.
      Doctor.countDocuments()
        .then(async (docCount) => {
          if (docCount === 0) {
            await Doctor.insertMany([
              {
                phone: "1111111111",
                name: "Kavita Deshmukh",
                hpId: "NHAA-1001",
                specialty: "Counselling",
                department: "Support & Counselling",
                languages: ["English", "Hindi", "Marathi"],
              },
              {
                phone: "2222222222",
                name: "Arun Malhotra",
                hpId: "NHAA-1002",
                specialty: "Police Liaison",
                department: "Escalation & Police Liaison",
                languages: ["English", "Hindi"],
              },
              {
                phone: "3333333333",
                name: "Neha Gupta",
                hpId: "NHAA-1003",
                specialty: "Legal Aid",
                department: "Legal Aid Cell",
                languages: ["English", "Hindi", "Gujarati"],
              },
              {
                phone: "4444444444",
                name: "Farhan Shaikh",
                hpId: "NHAA-1004",
                specialty: "Welfare",
                department: "Welfare & Rehabilitation",
                languages: ["Hindi", "Marathi", "Urdu"],
              },
              {
                phone: "5555555555",
                name: "Sunita Rao",
                hpId: "NHAA-1005",
                specialty: "Command",
                department: "Command & Triage",
                languages: ["English", "Hindi", "Gujarati", "Bengali"],
              },
            ]);
            console.log("Seeded Mock Support Officers.");
          }

          // Demo support cases (fictional) appear only when explicitly enabled.
          await seedSupportDemoData();
        })
        .catch(async (err) => {
          console.error("Failed to seed officers:", err?.message || err);
          await seedSupportDemoData();
        });
    });
  } catch (error) {
    console.error("Server failed to start:", error?.message || error);
    process.exit(1);
  }
};

startServer();