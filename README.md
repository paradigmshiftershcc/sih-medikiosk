# Sahaay — AI-Assisted Stress & Vulnerability Triage for NHAA

**Sahaay** (SIH26093) is a prototype for the **National Helpline against Atrocity (NHAA) 14566**: a multilingual, voice-first kiosk flow where a complainant shares what happened and the system produces a deterministic **Stress & Vulnerability Index (SVI)** plus evidence-backed **support pathway recommendations** for a human-staffed **Support Command Center** to act on.

> **This is an AI-assisted prototype for triage and support prioritization, not a diagnostic or autonomous decision system.** It never diagnoses, never makes legal/police/emergency decisions, and never contacts anyone automatically. AI assists the interview and signal extraction; every score, recommendation, and routing decision is deterministic and reviewed by authorized human personnel.

## What it does

- **Trauma-informed intake** — one short question at a time, in the complainant's own words; the user is in control and can stop anytime.
- **Consent first** — nothing is recorded or stored before explicit consent.
- **Multilingual + voice** — speak in Hindi, Marathi, Gujarati, Bengali, English or auto; audio is transcribed server-side (Bhashini primary, **Sarvam Saaras v3** fallback) into editable text before anything is sent. No audio is persisted (`RAW_AUDIO_RETENTION=0`).
- **Real voice analytics** — the browser extracts compact acoustic features (speech/silence ratio, pauses, long pauses, pitch mean/variation/range, energy variation, speech-rate proxy, spectral centroid) from the already-recorded clip. A deterministic interpreter turns them into *supporting voice/speech indicators* — never a diagnosis, never a score input. An optional Gemini audio-affect layer (`ENABLE_VOICE_AFFECT_AI=true`) adds observable speech characteristics in memory only.
- **Real-time per-turn assessment** — after every answered question the case merges high-confidence urgent signals, recomputes the SVI, stores a compact snapshot, and appends a timeline event (`TRANSCRIBING → ANALYZING → UPDATING ASSESSMENT → READY` is visible in the chat). Officers see the latest assessment after each turn, plus an **Assessment Replay** (Turn → SVI with deltas).
- **Deterministic SVI** — a fixed-weight engine (immediate danger +30, threats +20, severe fear/distress +15, intimidation +10, isolation/no support +10, displacement +10, self-harm +35, compounding +10 at ≥3 factor groups) classifies **LOW / MODERATE / HIGH / CRITICAL**. The AI never chooses the score; it only extracts *evidence-backed signals*. Self-harm statements and immediate danger **always** force CRITICAL. Every score ships with a point-by-point breakdown and `assessmentEngineVersion: "svi-prototype-v1"`.
- **Rule-based recommendations** — explicit pathway objects (`code`, `reason`, `triggerEvidence[]`, `priority`, `humanReviewRequired: true`): emergency support, human escalation, police/protection review (including victim/witness-protection eligibility review), counselling, legal aid, medical, shelter/rehabilitation, welfare. External referrals shown: NHAA **14566**, ERSS **112**, Tele-MANAS **14416**, NALSA **15100** — recommend → human review → external action, never automatic.
- **Human-in-the-loop** — CRITICAL and urgent cases surface to the Command Center immediately; every status change is a human officer action with a note. Nothing is escalated automatically.

## Repository layout

```
├── frontend/          # React + Vite SPA (deployed to Vercel)
├── backend/           # Node.js + Express + ES Modules API (deployed to Render)
└── render.yaml        # Render blueprint for the backend
```

## API surface

All routes are protected with JWT (roles `patient`/`doctor` internally = *complainant*/*officer* in the UI).

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/request-otp` / `verify-officer-otp` / `verify-patient-otp` | public | Demo OTP login |
| POST | `/api/cases` | complainant | Create case (requires `consent.granted`) |
| GET | `/api/cases` | complainant | List own cases |
| GET | `/api/cases/:caseId` | owner or officer | Case detail |
| POST | `/api/cases/:caseId/chat` | owner | One support-chat turn: AI reply + per-turn urgent-signal merge + SVI recompute + snapshot + event; accepts `voiceAnalytics` features (audio in-memory only, never stored); returns live `svi`, `aiAvailable`, `voiceObservations` |
| POST | `/api/cases/:caseId/transcribe` | owner | Voice transcription (no DB writes) |
| POST | `/api/cases/:caseId/assess` | owner | Compute SVI + recommendations (AI never scores) |
| POST | `/api/cases/:caseId/submit` | owner | Move from NEW → IN_REVIEW (enters queue) |
| GET | `/api/queue` | officer | Support Command Center queue (CRITICAL → LOW) |
| PATCH | `/api/cases/:caseId/status` | officer | IN_REVIEW / ESCALATED / RESOLVED / CLOSED |
| PATCH | `/api/cases/:caseId/assignment` | officer | Assign to self |
| PATCH | `/api/cases/:caseId/meta` | officer | NHAA metadata: docket, channel, incident type, safety, support needs (never affects SVI) |
| GET | `/api/health` | public | Liveness + DB readiness |

SVI disclaimer returned with every assessment: *"Prototype vulnerability triage index — not a clinical diagnosis or legally validated risk instrument."*

## LOCAL DEVELOPMENT

### Prerequisites
- Node.js 22+
- MongoDB (local or Atlas)
- A Google Gemini API key (falls back to deterministic behavior when unavailable)

### Backend

```bash
cd backend
cp .env.example .env    # then fill in real values
npm install
npm run dev             # nodemon, listens on PORT (default 5000)
```

### Frontend

```bash
cd frontend
cp .env.example .env    # set VITE_API_URL (default http://localhost:5000/api)
npm install
npm run dev             # Vite dev server
```

### Demo data & mock login

- On first boot the backend seeds **5 fictional support officers** (Kavita Deshmukh, Arun Malhotra, Neha Gupta, Farhan Shaikh, Sunita Rao; phones `1111111111`–`5555555555`).
- With `SEED_DEMO=true` it also seeds **5 fictional demo cases** (`DEMO-2026-001…005`, clearly labelled DEMO DATA): Meena Rathore LOW/RESOLVED legal, Savitri Devi MODERATE/ASSIGNED threats+fear, Ramesh Pawar HIGH/IN_REVIEW threats+displacement, Imran Sheikh CRITICAL/NEW self-harm (Hindi), Anita Verma CRITICAL/NEW immediate danger (voice call, with voice indicators) — each with per-turn replay history, computed through the real SVI engine.
- Any phone + OTP `123456` logs in. Fresh complainants are auto-registered (phones like `9000000001`–`9000000005` for the demo).

## DEPLOYMENT

### Vercel (Frontend)

- **Root directory:** `frontend`, build `npm run build`, output `dist`.
- `frontend/vercel.json` SPA rewrites cover `/`, `/officer-login`, `/dashboard`, `/intake`, `/cases/:caseId`, `/command`, `/command/case/:caseId`.
- **Env var (dashboard):** `VITE_API_URL=https://<render-backend>.onrender.com/api`. Only `VITE_*` vars reach the browser — never put `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `BHASHINI_*`, or `SARVAM_API_KEY` there.

### Render (Backend)

Use the committed `render.yaml` blueprint (Docker web service, `/api/health`). Secrets are set in the Render dashboard only:

| Name | Notes |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Required; app refuses to start in production without it |
| `GEMINI_API_KEY` | Interview + signal-extraction LLM |
| `GEMINI_MODEL` | Primary model (default `gemini-3.6-flash`; verified ids only) |
| `GEMINI_MODEL_FALLBACKS` | Hedged fallbacks (default `gemini-3.7-flash,gemini-3.8-flash,gemini-3.5-flash-lite`) |
| `GEMINI_HEDGE_DELAY_MS` / `GEMINI_*_TIMEOUT_MS` / `GEMINI_MODEL_COOLDOWN_MS` | Failover tuning (defaults 2000 / 8000-20000 / 30000) |
| `ENABLE_VOICE_AFFECT_AI` | `true` enables the optional in-memory Gemini audio-affect layer |
| `RAW_AUDIO_RETENTION` | Must stay `0` — raw voice is never persisted |
| `FRONTEND_URL` | Comma-separated allowed CORS origins |
| `NODE_ENV` | `production` (set by render.yaml) |
| `BHASHINI_API_KEY` / `BHASHINI_USER_ID` / `BHASHINI_*` | Optional until Bhashini approval |
| `SARVAM_API_KEY` | Sarvam Saaras v3 transcription fallback |
| `SEED_DEMO` | `true` to seed fictional demo cases |

```bash
cd backend
docker build -t sahaay-backend .
docker run --rm -p 5000:5000 -e NODE_ENV=production \
  -e MONGO_URI=... -e JWT_SECRET=... -e GEMINI_API_KEY=... sahaay-backend
```

## APPLICATION EXPERIENCE

Both sides share an authenticated shell (sidebar + top bar + main area, collapsible on mobile) in the Sahaay palette. Visible terminology is always **Complainant / Officer**.

Complainant (`/dashboard`): Overview (Active Cases, Total Assessments, Pending Actions), Start New Assessment (`/intake`), My Cases (`/cases`), Case Status (`/cases/latest` → latest case), Support & Referrals (`/support`), Messages / Updates (`/updates`, real review activity), Profile (`/profile`), Help & Emergency (`/help`). Case view shows overview, status, assessment, recommendations, referrals, timeline, and consent — no officer controls.

Officer (`/command`): Command Center dashboard (Critical/High/Moderate/Low + danger/self-harm/protection/counselling/legal-aid summaries, priority table), Priority Queue (`/command/queue`, existing ordering + filters), All / Critical / Assigned-to-Me / Needs-Review / Escalated / Resolved lists, Analytics, Support Pathways, Assessment Trends (recharts, already installed — lazy-loaded), Notifications (derived), Audit Trail (merged real events), Profile. Every row opens the authoritative `SupportCaseDetail`; no assessment logic is duplicated.

Demo role switching: set `VITE_DEMO_MODE=true` (frontend `.env`) to show a top-right **VIEW AS** switcher. It only navigates — `ProtectedRoute` and backend authorization still enforce the real role, so it can never bypass access control. Ideal judge flow: complainant submits a case → VIEW AS Officer → officer login → new case on top of the queue → open → assign → escalate → audit trail.

## ARCHITECTURE

Complainant: Consent (5 plain-language purposes) → Intake (voice/text) → Transcription (Bhashini → Sarvam v3) → Voice Analytics (browser features → deterministic observations) → Evidence Extraction (Gemini, evidence-quoted) → Deterministic SVI (`svi-prototype-v1`) → Support Recommendations (rule-based pathways) → Human Review.

Officer: Command Center (priority queue: CRITICAL → immediate danger → self-harm → HIGH → newest; filters for risk/status/channel/language/pathway/incident type) → Explainable Assessment (score breakdown + evidence provenance + voice card + Assessment Replay) → Assign → Escalate / Resolve → Audit Trail.

Why this shape: voice analytics is *supporting evidence* (never scored, never diagnostic); Gemini never assigns risk (it extracts evidence; the deterministic engine scores); raw audio is never persisted (features only); every consequential step is human-reviewed; when Gemini is down the app degrades to deterministic safety analysis with an explicit banner instead of fake AI output.

## CHECKS & TESTS

```bash
cd frontend && npm run lint && npm run build        # frontend validation
cd backend  && npm test                              # 44 unit tests: SVI, ownership, voice, per-turn, queue, models
cd backend  && for f in $(find src -name '*.js'); do node --check "$f"; done
```

`.github/workflows/ci.yml` runs these on every push/PR (no secrets).

## SECURITY & LIMITATIONS

- **Secrets are never committed**; only `.env.example` (names, no values) is tracked.
- **Demo authentication** uses the fixed OTP `123456`; OTP delivery is not implemented — not safe for real-world auth.
- **Authorization** is enforced server-side: complainants only their own cases; officers on the queue/assigned work.
- **Data retention: `RAW_AUDIO_RETENTION=0`.** Raw voice is never persisted, never logged, never sent anywhere except the in-memory transcription/affect calls. Derived voice features + observations may be stored with the assessment; transcripts are stored on the case for human review; provider errors log safe status only.
- **Rate limiting and durable encryption at rest are not implemented** — documented limitations for this prototype.
- Internal Mongoose models/roles retain the `Patient`/`Doctor` names for engine compatibility; the visible product language is *complainant*/*officer*.