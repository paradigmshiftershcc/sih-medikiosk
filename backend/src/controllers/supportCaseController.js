import SupportCase from "../models/SupportCase.js";
import Doctor from "../models/Doctor.js";
import { transcribeAudio } from "../services/transcriptionService.js";
import {
  generateSupportQuestion,
  extractVulnerabilitySignals,
  extractUrgentSignalsFromText,
  mergePerTurnSignals,
  analyzeVoiceAffect,
  scanUrgentHints,
} from "../services/traumaAssessmentService.js";
import { computeSvi, toSafetyIndicators } from "../services/sviService.js";
import {
  buildRecommendations,
  GOVERNMENT_REFERRALS,
} from "../services/supportRecommendationService.js";
import {
  validateVoiceFeatures,
  interpretVoiceFeatures,
  VOICE_OBSERVATION_DISCLAIMER,
} from "../services/voiceAnalyticsService.js";

const VALID_STATUSES = ["NEW", "IN_REVIEW", "ESCALATED", "ASSIGNED", "RESOLVED", "CLOSED"];
const QUEUE_ELIGIBLE_STATUSES = ["NEW", "IN_REVIEW", "ESCALATED", "ASSIGNED"];
const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
const VALID_CHANNELS = ["VOICE_CALL", "WEB_PORTAL", "CHATBOT", "MOBILE_APP", "IVRS", "OTHER"];
const VALID_INCIDENT_TYPES = [
  "CASTE_DISCRIMINATION",
  "PHYSICAL_VIOLENCE",
  "SEXUAL_VIOLENCE",
  "THREAT_INTIMIDATION",
  "SOCIAL_BOYCOTT",
  "DISPLACEMENT",
  "FAMILY_DEATH",
  "LEGAL_PROCEEDING_DISTRESS",
  "OTHER",
  "UNKNOWN",
];
const VALID_SAFETY = ["SAFE", "UNSAFE", "UNKNOWN"];
const VALID_SUPPORT_NEEDS = [
  "COUNSELLING",
  "LEGAL_AID",
  "MEDICAL",
  "POLICE_REVIEW",
  "PROTECTION_REVIEW",
  "SHELTER_REHABILITATION",
  "EMERGENCY_SUPPORT",
  "HUMAN_REVIEW",
];

// RAW_AUDIO_RETENTION = 0: raw voice recordings are never persisted, never
// logged. Only derived voice features + observations may be stored.
export const RAW_AUDIO_RETENTION = 0;

// Ownership check that works whether complainantId is a raw ObjectId or a
// populated Patient document (getSupportCase populates before checking).
export const assertOwnership = (caseDoc, userId) => {
  const owner = caseDoc.complainantId?._id ?? caseDoc.complainantId;
  return owner?.toString() === String(userId);
};

const pushEvent = (caseDoc, status, officerName, note = "") => {
  caseDoc.events.push({ status, officerName: officerName || "", note });
};

// POST /api/cases — start a support session. Consent is recorded BEFORE any
// sensitive material is collected. No AI call happens here.
export const createSupportCase = async (req, res) => {
  try {
    const { language = "en", consent, openingMessage, sourceChannel = "WEB_PORTAL" } = req.body;

    const granted = Boolean(consent?.granted);
    if (!granted) {
      return res.status(400).json({
        message: "Your consent is required before we begin.",
      });
    }

    const normalizedLanguage = ["en", "hi", "mr", "gu", "bn", "auto"].includes(language)
      ? language
      : "en";
    const channel = VALID_CHANNELS.includes(sourceChannel) ? sourceChannel : "WEB_PORTAL";
    const scopes = consent?.scopes || {};

    const caseDoc = await SupportCase.create({
      complainantId: req.user.id,
      language: normalizedLanguage,
      sourceChannel: channel,
      consent: {
        granted: true,
        timestamp: new Date(),
        scopes: {
          intakeProcessing: Boolean(scopes.intakeProcessing ?? granted),
          voiceTranscription: Boolean(scopes.voiceTranscription ?? granted),
          aiAnalysis: Boolean(scopes.aiAnalysis ?? granted),
          storage: Boolean(scopes.storage ?? granted),
        },
        voiceNoticeAcknowledged: Boolean(consent?.voiceNoticeAcknowledged ?? granted),
      },
      transcript:
        typeof openingMessage === "string" && openingMessage.trim()
          ? [{ role: "user", content: openingMessage.trim(), source: "text" }]
          : [],
    });

    res.status(201).json({ caseId: caseDoc._id, language: caseDoc.language });
  } catch (error) {
    console.error("Create support case error:", error?.message || error);
    res.status(500).json({ message: "Error creating support session." });
  }
};

// POST /api/cases/:caseId/chat — one trauma-informed question turn with
// REAL-TIME per-turn assessment: after every answered question the case
// merges deterministic urgent signals, recomputes the SVI, stores derived
// voice indicators (features only — never raw audio), appends an assessment
// snapshot + timeline event, and returns the live score.
export const chatTurn = async (req, res) => {
  try {
    const {
      message,
      language = req.body.language,
      voiceAnalytics,
      audioBase64,
      mimeType,
    } = req.body;
    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });
    if (!assertOwnership(caseDoc, req.user.id)) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ message: "No input provided." });
    }

    const cleanMessage = message.trim();

    // 1. Derived voice indicators (client-computed features only).
    let voiceResult = null;
    if (voiceAnalytics && typeof voiceAnalytics === "object") {
      const { valid, features } = validateVoiceFeatures(voiceAnalytics);
      if (valid) {
        voiceResult = {
          features,
          observations: interpretVoiceFeatures(features),
        };
      }
    }

    // 2. OPTIONAL Gemini audio-affect layer (in-memory only, never stored).
    let affect = { enabled: false, observations: [] };
    if (voiceResult && typeof audioBase64 === "string" && audioBase64) {
      affect = await analyzeVoiceAffect({ audioBase64, mimeType });
    }

    if (voiceResult) {
      caseDoc.voiceAnalytics = {
        features: voiceResult.features,
        observations: voiceResult.observations,
        affectObservations: Array.isArray(affect.observations) ? affect.observations : [],
        affectDisclaimer: affect.enabled && !affect.unavailable
          ? "Observable speech characteristics, not a clinical diagnosis."
          : "",
        source: "CLIENT_FEATURES",
        updatedAt: new Date(),
      };
    }

    // 3. Transcript turn.
    caseDoc.transcript.push({
      role: "user",
      content: cleanMessage,
      source: voiceResult ? "voice" : "text",
    });
    if (["hi", "mr", "gu", "bn", "auto"].includes(language)) caseDoc.language = language;

    const ai = await generateSupportQuestion(caseDoc.transcript, {
      language: caseDoc.language,
    });
    caseDoc.transcript.push({ role: "model", content: ai.response, source: "text" });

    // 4. Per-turn deterministic urgent-signal merge (latest message only).
    const perTurn = extractUrgentSignalsFromText(cleanMessage);
    const currentSignals = caseDoc.vulnerabilitySignals?.toObject?.() || {
      ...(caseDoc.vulnerabilitySignals || {}),
    };
    const { merged, newSignals } = mergePerTurnSignals(currentSignals, perTurn.signals);
    for (const key of newSignals) {
      caseDoc.vulnerabilitySignals[key] = true;
    }
    for (const item of perTurn.evidence) {
      const dup = (caseDoc.evidence || []).some(
        (e) => e.signal === item.signal && e.evidence === item.evidence,
      );
      if (!dup) caseDoc.evidence.push(item);
    }

    // 5. Recompute SVI + recommendations from accumulated signals.
    const prevScore = caseDoc.assessment?.svi?.score ?? null;
    const svi = computeSvi(merged, caseDoc.evidence || []);
    const support = buildRecommendations(merged, caseDoc.evidence || []);
    caseDoc.assessment = { svi, recommendations: support.recommendations };
    caseDoc.safetyIndicators = toSafetyIndicators(merged);

    caseDoc.urgentFlag =
      Boolean(ai.immediateDangerMentioned) ||
      merged.immediateDanger ||
      merged.selfHarmStatement ||
      scanUrgentHints(caseDoc.transcript);

    // 6. Snapshot + timeline event (powers Assessment Replay).
    const turnIndex = caseDoc.transcript.filter((m) => m.role === "user").length;
    caseDoc.assessmentHistory.push({
      at: new Date(),
      turn: turnIndex,
      score: svi.score,
      riskLevel: svi.riskLevel,
      newSignals,
      voiceAvailable: Boolean(voiceResult),
    });
    const deltaNote =
      prevScore === null
        ? `Initial per-turn assessment: SVI ${svi.score} (${svi.riskLevel}).`
        : `SVI updated ${prevScore} → ${svi.score} (${svi.riskLevel}).`;
    pushEvent(
      caseDoc,
      "ASSESSMENT_UPDATED",
      "",
      `${deltaNote}${newSignals.length ? ` New urgent signals: ${newSignals.join(", ")}.` : ""}${voiceResult ? " Voice indicators extracted." : ""}`,
    );

    if (Boolean(ai.isComplete)) {
      caseDoc.status = "IN_REVIEW";
    }
    await caseDoc.save();

    const aiAvailable = ai.provider !== "deterministic-fallback";
    res.status(200).json({
      caseId: caseDoc._id,
      response: ai.response,
      isComplete: Boolean(ai.isComplete),
      immediateDangerMentioned: Boolean(ai.immediateDangerMentioned),
      urgentFlag: caseDoc.urgentFlag,
      aiAvailable,
      assessmentUpdated: prevScore === null || prevScore !== svi.score || newSignals.length > 0,
      svi: { score: svi.score, riskLevel: svi.riskLevel, band: svi.band },
      newSignals,
      voiceObservations: voiceResult ? voiceResult.observations : [],
      voiceDisclaimer: voiceResult ? VOICE_OBSERVATION_DISCLAIMER : "",
    });
  } catch (error) {
    console.error("Support chat turn error:", error?.message || error);
    res.status(500).json({ message: "Error processing your message." });
  }
};

// POST /api/cases/:caseId/transcribe — transcription only. Converts voice to
// editable text for complainant review. Creates nothing, stores nothing.
export const transcribeVoiceInCase = async (req, res) => {
  try {
    const { audioBase64, mimeType, language = "en" } = req.body;

    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });
    if (!assertOwnership(caseDoc, req.user.id)) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }

    if (!audioBase64) {
      return res.status(400).json({ message: "No audio provided." });
    }

    try {
      const result = await transcribeAudio({ audioBase64, mimeType, language });
      return res.status(200).json({
        text: result.text,
        language: result.language,
        provider: result.provider,
      });
    } catch (err) {
      return res.status(503).json({
        message:
          "Voice transcription is temporarily unavailable. Please type your answer instead.",
      });
    }
  } catch (error) {
    console.error("Transcription error:", error?.message || error);
    return res.status(503).json({
      message:
        "Voice transcription is temporarily unavailable. Please type your answer instead.",
    });
  }
};

// POST /api/cases/:caseId/assess — extract evidence-backed signals, compute
// the deterministic SVI, and derive rule-based support recommendations.
export const assessCase = async (req, res) => {
  try {
    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });
    if (!assertOwnership(caseDoc, req.user.id)) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }

    if (caseDoc.transcript.length === 0) {
      return res
        .status(400)
        .json({ message: "Nothing to assess yet. Share a few words first." });
    }

    const extracted = await extractVulnerabilitySignals(caseDoc.transcript);

    // Safety-preserving merge: urgent flags already caught per-turn (with
    // quoted evidence) are NEVER cleared by the full extraction.
    const preUrgent = {
      immediateDanger: Boolean(caseDoc.vulnerabilitySignals?.immediateDanger),
      selfHarmStatement: Boolean(caseDoc.vulnerabilitySignals?.selfHarmStatement),
      reportedThreats: Boolean(caseDoc.vulnerabilitySignals?.reportedThreats),
    };
    const signals = { ...(extracted.signals || {}) };
    for (const key of Object.keys(preUrgent)) {
      if (preUrgent[key]) signals[key] = true;
    }
    const mergedEvidence = [...(extracted.evidence || [])];
    for (const item of caseDoc.evidence || []) {
      const dup = mergedEvidence.some(
        (e) => e.signal === item.signal && e.evidence === item.evidence,
      );
      if (preUrgent[item.signal] && !dup) mergedEvidence.push({ ...item });
    }

    const svi = computeSvi(signals, mergedEvidence);
    const safety = toSafetyIndicators(signals);
    const support = buildRecommendations(signals, mergedEvidence);

    caseDoc.incident.narrative = extracted.incidentSummary;
    caseDoc.incident.category = extracted.category;
    caseDoc.vulnerabilitySignals = signals;
    caseDoc.safetyIndicators = safety;
    caseDoc.evidence = mergedEvidence;
    caseDoc.assessment = {
      svi,
      recommendations: support.recommendations,
    };
    caseDoc.incidentType = extracted.incidentType || "UNKNOWN";
    caseDoc.immediateSafety = extracted.immediateSafety || "UNKNOWN";
    caseDoc.supportNeeds = Array.isArray(extracted.supportNeeds)
      ? extracted.supportNeeds
      : [];
    caseDoc.urgentFlag =
      Boolean(extracted.needsImmediateHumanReview) || scanUrgentHints(caseDoc.transcript);
    const finalTurn = caseDoc.transcript.filter((m) => m.role === "user").length;
    caseDoc.assessmentHistory.push({
      at: new Date(),
      turn: finalTurn,
      score: svi.score,
      riskLevel: svi.riskLevel,
      newSignals: [],
      voiceAvailable: Boolean(caseDoc.voiceAnalytics?.features),
    });
    pushEvent(
      caseDoc,
      "ASSESSMENT_UPDATED",
      "",
      `Full assessment completed: SVI ${svi.score} (${svi.riskLevel}).`,
    );
    await caseDoc.save();

    res.status(200).json({
      caseId: caseDoc._id,
      incident: caseDoc.incident,
      signals,
      evidence: mergedEvidence,
      safetyIndicators: safety,
      missingInformation: extracted.missingInformation,
      incidentType: caseDoc.incidentType,
      immediateSafety: caseDoc.immediateSafety,
      supportNeeds: caseDoc.supportNeeds,
      signalConfidence: extracted.signalConfidence || {},
      svi,
      recommendations: support.recommendations,
      reviewNote: support.note,
      referrals: GOVERNMENT_REFERRALS,
      needsImmediateHumanReview: caseDoc.urgentFlag,
      degraded: Boolean(extracted.degraded),
    });
  } catch (error) {
    console.error("Assessment error:", error?.message || error);
    res.status(500).json({ message: "Failed to prepare the support assessment." });
  }
};

// POST /api/cases/:caseId/submit — complainant confirms and the case enters
// the NHAA support queue. Requires a completed assessment.
export const submitCase = async (req, res) => {
  try {
    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });
    if (!assertOwnership(caseDoc, req.user.id)) {
      return res.status(403).json({ message: "Unauthorized access to case." });
    }
    // NOTE: score 0 (LOW) is a valid completed assessment — only a missing
    // assessment blocks submission.
    if (
      caseDoc.assessment?.svi?.score === undefined ||
      caseDoc.assessment?.svi?.score === null
    ) {
      return res
        .status(400)
        .json({ message: "Finish the assessment review before submitting." });
    }

    caseDoc.submittedAt = new Date();
    if (caseDoc.status === "NEW") caseDoc.status = "IN_REVIEW";
    pushEvent(caseDoc, caseDoc.status, "", "Submitted to the support queue by the complainant.");
    await caseDoc.save();

    res.status(200).json({
      message: "Your case has been sent for human support review.",
      caseId: caseDoc._id,
      status: caseDoc.status,
    });
  } catch (error) {
    console.error("Submit case error:", error?.message || error);
    res.status(500).json({ message: "Failed to submit your case." });
  }
};

// GET /api/cases/:caseId — complainant may read only their own case; support
// officers (any role=doctor) may review any queue case for triage.
export const getSupportCase = async (req, res) => {
  try {
    const caseDoc = await SupportCase.findById(req.params.caseId)
      .populate("complainantId", "name phone")
      .populate("assignedOfficerId", "name department");
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });

    if (req.user.role !== "doctor") {
      if (!assertOwnership(caseDoc, req.user.id)) {
        return res.status(403).json({ message: "Unauthorized access to case." });
      }
    }

    res.status(200).json({
      _id: caseDoc._id,
      complainant: caseDoc.complainantId,
      language: caseDoc.language,
      sourceChannel: caseDoc.sourceChannel,
      externalReference: caseDoc.externalReference,
      consent: caseDoc.consent,
      transcript: caseDoc.transcript,
      incident: caseDoc.incident,
      incidentType: caseDoc.incidentType,
      immediateSafety: caseDoc.immediateSafety,
      supportNeeds: caseDoc.supportNeeds,
      vulnerabilitySignals: caseDoc.vulnerabilitySignals,
      safetyIndicators: caseDoc.safetyIndicators,
      evidence: caseDoc.evidence,
      assessment: caseDoc.assessment,
      assessmentHistory: caseDoc.assessmentHistory,
      voiceAnalytics: caseDoc.voiceAnalytics
        ? {
            features: caseDoc.voiceAnalytics.features,
            observations: caseDoc.voiceAnalytics.observations,
            affectObservations: caseDoc.voiceAnalytics.affectObservations,
            affectDisclaimer: caseDoc.voiceAnalytics.affectDisclaimer,
            source: caseDoc.voiceAnalytics.source,
            updatedAt: caseDoc.voiceAnalytics.updatedAt,
            disclaimer: VOICE_OBSERVATION_DISCLAIMER,
          }
        : null,
      urgentFlag: caseDoc.urgentFlag,
      submittedAt: caseDoc.submittedAt,
      status: caseDoc.status,
      assignedOfficer: caseDoc.assignedOfficerId,
      events: caseDoc.events,
      referrals: GOVERNMENT_REFERRALS,
      createdAt: caseDoc.createdAt,
      updatedAt: caseDoc.updatedAt,
    });
  } catch (error) {
    console.error("Get support case error:", error?.message || error);
    res.status(500).json({ message: "Error loading the support case." });
  }
};

// GET /api/cases — complainant's own support cases.
export const listMyCases = async (req, res) => {
  try {
    const cases = await SupportCase.find({ complainantId: req.user.id })
      .select(
        "_id language status submittedAt createdAt updatedAt urgentFlag incident.narrative incident.category safetyIndicators assessment.svi.score assessment.svi.riskLevel",
      )
      .sort({ createdAt: -1 });
    res.status(200).json(cases);
  } catch (error) {
    console.error("List cases error:", error?.message || error);
    res.status(500).json({ message: "Error loading your support cases." });
  }
};

// Queue priority: 1. CRITICAL band 2. immediate danger 3. self-harm
// concern 4. HIGH band, then lower bands. Within the same priority the
// newest submitted case comes first.
export const compareQueuePriority = (a, b) => {
  const riskDiff =
    (RISK_ORDER[a.svi?.riskLevel] ?? 4) - (RISK_ORDER[b.svi?.riskLevel] ?? 4);
  if (riskDiff !== 0) return riskDiff;
  if (Boolean(b.immediateDanger) !== Boolean(a.immediateDanger)) {
    return b.immediateDanger ? 1 : -1;
  }
  if (Boolean(b.selfHarm) !== Boolean(a.selfHarm)) {
    return b.selfHarm ? 1 : -1;
  }
  return new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0);
};

// Queue filter builder (exported for unit tests). Default scope is the
// active queue; scope=all returns every submitted case (for All Cases /
// Resolved views). Officer-only either way; priority ordering unchanged.
export const buildQueueFilter = (scope) =>
  scope === "all"
    ? { submittedAt: { $ne: null } }
    : { submittedAt: { $ne: null }, status: { $in: QUEUE_ELIGIBLE_STATUSES } };

// GET /api/queue — support command center queue, sorted by severity.
export const getSupportQueue = async (req, res) => {
  try {
    const cases = await SupportCase.find(buildQueueFilter(req.query?.scope))
      .populate("complainantId", "name phone")
      .populate("assignedOfficerId", "name department")
      .sort({ createdAt: -1 });

    const enriched = cases.map((caseDoc) => ({
      _id: caseDoc._id,
      complainant: caseDoc.complainantId,
      language: caseDoc.language,
      sourceChannel: caseDoc.sourceChannel,
      incident: caseDoc.incident,
      incidentType: caseDoc.incidentType,
      immediateSafety: caseDoc.immediateSafety,
      supportNeeds: caseDoc.supportNeeds,
      status: caseDoc.status,
      urgentFlag: caseDoc.urgentFlag,
      immediateDanger: Boolean(caseDoc.vulnerabilitySignals?.immediateDanger),
      selfHarm: Boolean(caseDoc.vulnerabilitySignals?.selfHarmStatement),
      submittedAt: caseDoc.submittedAt,
      createdAt: caseDoc.createdAt,
      assignedOfficer: caseDoc.assignedOfficerId,
      svi: caseDoc.assessment?.svi || null,
    }));

    enriched.sort(compareQueuePriority);

    res.status(200).json(enriched);
  } catch (error) {
    console.error("Queue fetch error:", error?.message || error);
    res.status(500).json({ message: "Error loading the support queue." });
  }
};

// PATCH /api/cases/:caseId/meta — officer updates NHAA case metadata
// (docket, channel, incident type, safety, support needs). Metadata never
// affects the SVI.
export const updateCaseMeta = async (req, res) => {
  try {
    const { docketNumber, incidentType, immediateSafety, supportNeeds, sourceChannel, note } =
      req.body || {};

    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });

    if (typeof docketNumber === "string") {
      caseDoc.externalReference.docketNumber = docketNumber.trim().slice(0, 80);
    }
    if (incidentType !== undefined) {
      if (!VALID_INCIDENT_TYPES.includes(incidentType)) {
        return res.status(400).json({ message: "Invalid incident type." });
      }
      caseDoc.incidentType = incidentType;
    }
    if (immediateSafety !== undefined) {
      if (!VALID_SAFETY.includes(immediateSafety)) {
        return res.status(400).json({ message: "Invalid safety value." });
      }
      caseDoc.immediateSafety = immediateSafety;
    }
    if (supportNeeds !== undefined) {
      if (
        !Array.isArray(supportNeeds) ||
        !supportNeeds.every((n) => VALID_SUPPORT_NEEDS.includes(n))
      ) {
        return res.status(400).json({ message: "Invalid support needs." });
      }
      caseDoc.supportNeeds = [...new Set(supportNeeds)];
    }
    if (sourceChannel !== undefined) {
      if (!VALID_CHANNELS.includes(sourceChannel)) {
        return res.status(400).json({ message: "Invalid source channel." });
      }
      caseDoc.sourceChannel = sourceChannel;
    }

    const officer = await Doctor.findById(req.user.id);
    pushEvent(
      caseDoc,
      caseDoc.status,
      officer?.name || "Support Officer",
      typeof note === "string" && note.trim()
        ? note.slice(0, 500)
        : "NHAA case metadata updated.",
    );
    await caseDoc.save();

    res.status(200).json({
      message: "Case metadata updated.",
      sourceChannel: caseDoc.sourceChannel,
      externalReference: caseDoc.externalReference,
      incidentType: caseDoc.incidentType,
      immediateSafety: caseDoc.immediateSafety,
      supportNeeds: caseDoc.supportNeeds,
      events: caseDoc.events,
    });
  } catch (error) {
    console.error("Update meta error:", error?.message || error);
    res.status(500).json({ message: "Error updating case metadata." });
  }
};

// PATCH /api/cases/:caseId/status — officer status transition (human review).
export const updateCaseStatus = async (req, res) => {
  try {
    const { status, note } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status value." });
    }

    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });

    const officer = await Doctor.findById(req.user.id);
    const officerName = officer?.name || "Support Officer";

    caseDoc.status = status;
    pushEvent(caseDoc, status, officerName, typeof note === "string" ? note.slice(0, 500) : "");
    await caseDoc.save();

    res.status(200).json({
      message: "Status updated.",
      status: caseDoc.status,
      events: caseDoc.events,
    });
  } catch (error) {
    console.error("Update status error:", error?.message || error);
    res.status(500).json({ message: "Error updating the case status." });
  }
};

// PATCH /api/cases/:caseId/assignment — officer takes ownership of a case.
export const updateCaseAssignment = async (req, res) => {
  try {
    const officerId = req.body.officerId || req.user.id;
    const officer = await Doctor.findById(officerId);
    if (!officer) {
      return res.status(400).json({ message: "Officer not found." });
    }

    const caseDoc = await SupportCase.findById(req.params.caseId);
    if (!caseDoc) return res.status(404).json({ message: "Case not found" });

    caseDoc.assignedOfficerId = officer._id;
    caseDoc.status = "ASSIGNED";
    pushEvent(
      caseDoc,
      "ASSIGNED",
      officer.name,
      typeof req.body.note === "string" ? req.body.note.slice(0, 500) : "",
    );
    await caseDoc.save();

    res.status(200).json({
      message: `Case assigned to ${officer.name}.`,
      status: caseDoc.status,
      assignedOfficer: { _id: officer._id, name: officer.name, department: officer.department },
    });
  } catch (error) {
    console.error("Assignment error:", error?.message || error);
    res.status(500).json({ message: "Error assigning the case." });
  }
};