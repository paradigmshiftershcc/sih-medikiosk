# MediKiosk

MediKiosk is a SIH hackathon prototype for AI-assisted medical intake kiosks: conversational patient history (Gemini), medical document OCR (Gemini), AYUSH profiling, multilingual audio (Bhashini), and doctor queue routing (MongoDB + JWT OTP auth).

> **IMPORTANT — This is a hackathon prototype.**
> It does NOT claim HIPAA compliance, production healthcare/clinical-safety certification, ABDM production certification, real HPR authentication, or production ABHA integration. Authentication uses a **mock OTP (`123456`)**. Do not use with real patient data in production.

## Repository layout

```
├── frontend/          # React + Vite SPA (deployed to Vercel)
├── backend/           # Node.js + Express + ES Modules API (deployed to Render)
└── render.yaml        # Render blueprint for the backend
```

## LOCAL DEVELOPMENT

### Prerequisites
- Node.js 22+ (LTS)
- MongoDB (local or Atlas)
- A Google Gemini API key

### Backend

```bash
cd backend
cp .env.example .env      # then fill in real values
npm install
npm run dev               # nodemon, listens on PORT (default 5000)
```

Required backend env vars (see `backend/.env.example`):
`PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, optional `FRONTEND_URL` and `BHASHINI_*`.

### Frontend

```bash
cd frontend
cp .env.example .env      # set VITE_API_URL (default http://localhost:5000/api)
npm install
npm run dev               # Vite dev server
```

`VITE_API_URL` defaults to `http://localhost:5000/api` when unset.

### Seeded demo doctors
On startup the backend seeds five mock HPR doctors (phone numbers `1111111111`–`5555555555`) if the database is empty. Login for either role uses the mock OTP `123456`.

## DEPLOYMENT

### Vercel (Frontend)

- **Root directory:** `frontend`
- **Build command:** `npm run build` (default for Vite)
- **Output directory:** `dist`
- `frontend/vercel.json` contains SPA rewrites so direct navigation/refresh works on `/dashboard`, `/intake`, `/consultation/:caseId`, `/doctor-login`, `/doctor/dashboard`, `/doctor/case/:caseId`, and any other client route.
- **Environment variable (Vercel dashboard):**

| Name | Value |
| --- | --- |
| `VITE_API_URL` | `https://<your-render-backend>.onrender.com/api` |

Only non-secret values may use `VITE_*` variables — **never** put `GEMINI_API_KEY`, `MONGO_URI`, `JWT_SECRET`, or `BHASHINI_*` in frontend env vars.

### Render (Backend)

Two supported options:

1. **Blueprint (recommended):** commit `render.yaml` and create a new Blueprint instance from the repo. It defines a Docker web service for `./backend/Dockerfile` with health check `/api/health`. Secrets are **not** stored in the repo.
2. **Manual Docker service:** use the web dashboard → New → Web Service → Docker, pointing at `backend/Dockerfile`.

- **Start command:** `node src/index.js` (defined in the `Dockerfile`; default `CMD` runs the app)
- **Port:** the app listens on the `PORT` env var provided by Render (falls back to `5000`)
- **Health check path:** `/api/health`

**Required environment variables (set in the Render dashboard — never commit):**

| Name | Notes |
| --- | --- |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Required; the app refuses to start in production without it |
| `GEMINI_API_KEY` | Google Gemini key |
| `FRONTEND_URL` | Comma-separated allowed CORS origins, e.g. `https://medikiosk.vercel.app` |
| `NODE_ENV` | `production` (set by render.yaml) |
| `BHASHINI_API_KEY` | Optional until Bhashini approval |
| `BHASHINI_USER_ID` | Optional until Bhashini approval |
| `BHASHINI_PIPELINE_ID` | Optional until Bhashini approval |

Health check details: `/api/health` returns `{ status: "ok"|"degraded", database: "connected"|"disconnected" }`. It never exposes the DB URI, credentials, or internal paths. The server does not accept traffic until the DB connects, so Render won't mark it ready while it cannot operate.

CORS behavior: configured `FRONTEND_URL` origins, `localhost` (local dev), and `*.vercel.app` (preview deployments) are allowed. Everything else is rejected.

### Docker

```bash
cd backend
docker build -t medikiosk-backend .
docker run --rm -p 5000:5000 \
  -e NODE_ENV=production \
  -e MONGO_URI=... \
  -e JWT_SECRET=... \
  -e GEMINI_API_KEY=... \
  medikiosk-backend
```

The image uses Node 22 Alpine, `npm ci` for reproducible installs, a non-root user, and contains **no** `.env`, secrets, or local files.

### GitHub Actions

`.github/workflows/ci.yml` runs on every push and pull request:
- Frontend: `npm ci` → `npm run lint` → `npm run build`
- Backend: `npm ci` → syntax check all `src/*.js` with `node --check`

CI uses no secrets.

## SECURITY NOTES

- **Secrets are never committed.** `.env` and `.env.*` are gitignored; only `.env.example` files (variable names, no values) are tracked. Add real values only to your local `.env` or the Render/Vercel dashboards.
- **Mock authentication:** all logins use the fixed demo OTP `123456`. The UI labels this as demo behavior. Not safe for real-world auth; OTP delivery is not implemented.
- **Request limits:** JSON/urlencoded bodies are capped at 10MB (document images and audio clips arrive as Base64). OCR uploads are further restricted server-side to JPG/PNG/WEBP and a Base64 size of ~8MB.
- **Authorization:** patients can only read/write their own cases; doctors can only read cases assigned to them (checked server-side on every sensitive endpoint).
- **Logging:** no logs contain API keys, tokens, OTPs, the DB URI, Base64 images/audio, or patient transcripts. Provider errors are logged as safe status/message only.

## Scripts / checks

```bash
cd frontend && npm run lint && npm run build   # frontend validation
cd backend  && for f in $(find src -name '*.js'); do node --check "$f"; done  # syntax validation
```