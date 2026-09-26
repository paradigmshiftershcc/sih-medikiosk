# SIH26093 — Presentation Content

Six-slide source document for the Sahaay pitch. Keep strictly to facts that are
implemented in this prototype.

## 1. Title / Identification

- **Problem Statement:** SIH26093 — AI-based real-time stress and trauma assessment for victims/complainants of the National Helpline against Atrocity (NHAA 14566).
- **Solution:** **Sahaay** — AI-Assisted Stress & Vulnerability Triage for NHAA. A multilingual, voice-first kiosk experience that listens to a complainant, extracts evidence-backed vulnerability signals, computes a deterministic Stress & Vulnerability Index (SVI), and routes recommendations to a human-staffed Support Command Center.
- **Team / College / Mentor:** *(fill in final team details)*

## 2. Proposed Solution

- **Complainant flow (consent + control):** the user shares their account in their own language — typed or spoken — one question at a time. Five plain-language consent purposes (intake, voice, AI analysis, storage, withdrawal) precede everything; voice input is individually optional; the user stays in control and may stop at any time.
- **Real voice analytics, honestly labelled:** the browser derives speech/silence ratio, pauses, long pauses, pitch variation, energy variation, speech-rate proxy, and spectral centroid from the recorded clip; a deterministic interpreter produces *supporting voice/speech indicators* — never a diagnosis, never a score input. Raw audio is never stored (`RAW_AUDIO_RETENTION=0`).
- **Real-time per-turn assessment:** after every answered question the SVI recomputes from accumulated evidence, a snapshot is stored, and a timeline event records the delta (`TRANSCRIBING → ANALYZING → UPDATING ASSESSMENT → READY` is visible live in the chat).
- **Deterministic triage, not AI judgment:** the LLM only asks trauma-informed questions and extracts signals with quoted evidence; a fixed-weight engine computes the SVI (LOW / MODERATE / HIGH / CRITICAL) with a point-by-point breakdown (`svi-prototype-v1`). Self-harm statements or immediate danger always force CRITICAL.
- **Rule-based support pathways:** emergency support, human escalation, police/protection review (incl. victim/witness-protection eligibility review), counselling, legal aid, medical, shelter/rehabilitation, welfare — each with priority, trigger evidence, and mandatory human review. External referrals shown: NHAA 14566, ERSS 112, Tele-MANAS 14416, NALSA 15100. Never auto-contacted.
- **Support Command Center:** a human queue sorted CRITICAL → immediate danger → self-harm → HIGH → newest, with risk/status/channel/language/pathway/incident-type filters; per-case evidence provenance, voice card, Assessment Replay (Turn → SVI), NHAA docket metadata, assignment, status actions, and a timestamped review trail.
- **Human-in-the-loop guarantee:** AI-assisted triage; final decisions always remain with authorized human personnel.

## 3. Technical Approach

- **Frontend:** React 19 + Vite + Tailwind (v4 tokens), progressive SPA with `Login`, `OfficerLogin`, `IntakeFlow` (consent → trauma-informed chat → review → submit), `CaseStatus`, officer `OfficerDashboard` + `PriorityQueue` + case lists/analytics, `SupportCaseDetail`. Mobile-friendly for kiosk terminals.
- **Backend:** Node.js + Express + Mongoose (ESM). JWT role-based auth with mock OTP (`123456`) demo login.
- **Multilingual + voice:** MediaRecorder mic capture → WAV → server-side transcription (Bhashini primary, **Sarvam Saaras v3** fallback) → editable text → manual send, transparently in English / Hindi / Marathi / Gujarati / Bengali / auto. Raw audio is never persisted.
- **AI layer (Gemini 3.6 Flash baseline, verified ids, `GEMINI_MODEL` chain):** trauma-informed single-question interviewer with an urgent-safety rule (stops and flags "immediate safety may be at risk"); structured, evidence-quoted signal extraction incl. incident type, immediate safety, support needs, and per-signal confidence. Optional in-memory audio-affect observations behind `ENABLE_VOICE_AFFECT_AI`. Deterministic fallback with an explicit "AI analysis unavailable" banner when the provider is down.
- **SVI engine (deterministic):** immediate danger +30, threats +20, severe fear/distress +15, intimidation +10, isolation/no support +10, displacement +10, self-harm +35, compounding +10 at ≥3 factor groups, clamp 0–100; bands 0–24 LOW, 25–49 MODERATE, 50–74 HIGH, 75–100 CRITICAL.
- **Security posture:** no secrets in repo, helmet, CORS allowlist, prod JWT/Mongo enforcement, ownership checks per endpoint, no audio/sensitive data in logs.

## 4. Feasibility & Viability

- **Works with existing NHAA 14566 infrastructure:** kiosks only need a browser + microphone; no special hardware.
- **Incremental deployment:** the support engine runs with or without live AI keys (deterministic fallbacks); Bhashini is opt-in with Sarvam v3 as the always-available transcription fallback.
- **Low operational risk:** the AI has no authority — scores, recommendations, statuses and escalations are deterministic or human-made, making behavior auditable and reproducible.
- **Cost-efficient:** lightweight Gemini flash-tier model for interview + extraction; GPU-free; containers run anywhere (Render/Docker/Vercel).
- **Simplest possible demo path:** fully seeded fictional officers and cases, mock OTP, single-command local run.

## 5. Impact & Benefits

- **Lowered barriers for complainants:** speak, don't type; no stigma in sharing; consent-first privacy preserves trust.
- **Faster, fairer triage:** consistent scoring of urgency across states, districts and helpline agents; highest-risk cases rise above the queue automatically.
- **Better human decision-making:** every score is traceable to quoted evidence; officers see factors, indicators, transcript and recommendations in one place.
- **Staff productivity:** officers spend time on support, not on re-reading transcripts; a full audit trail records every human decision.
- **National scalability:** one backend serves any NHAA kiosk or web session; language list extends via the existing transcription providers.

## 6. Working Prototype / Future Scope

**Working prototype (implemented):**
- 5-purpose consent → multilingual/voice intake → transcription → voice analytics → evidence-backed signal extraction.
- Per-turn SVI evolution with snapshots, replay, and assessment timeline events.
- Deterministic SVI (`svi-prototype-v1`, explainable breakdown) + rule-based recommendations (44/44 unit tests passing: SVI, ownership, voice, per-turn, queue, models).
- Command Center queue (priority-sorted + filtered), assignment, status workflow, NHAA metadata editor, review timeline.
- 5 fictional support officers + 5 fictional demo cases (`DEMO-2026-001…005`) spanning LOW → CRITICAL, each with replay history.
- Frontend lint + production build green; backend syntax-checked end to end.

**Future scope:**
- Production authentication (real OTP delivery), rate limiting, encryption at rest.
- Integration with NHAA CRM/case management; live call-handover workflows.
- Model fine-tuning on de-identified NHAA support transcripts with strict consent.
- Regional-language expansion and offline kiosk resilience.
- Evaluated by qualified counsellors and validated against a recognized risk-assessment reference.