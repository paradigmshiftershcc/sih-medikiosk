import Patient from "../models/Patient.js";
import Doctor from "../models/Doctor.js";
import SupportCase from "../models/SupportCase.js";
import { computeSvi, toSafetyIndicators } from "../services/sviService.js";
import { buildRecommendations } from "../services/supportRecommendationService.js";
import { interpretVoiceFeatures } from "../services/voiceAnalyticsService.js";

// Sahaay demo data (SIH26093). Gated behind SEED_DEMO=true so the command
// center shows a representative queue of fictional cases on first boot.
// All names and identifiers are fictional.

const DEMO_COMPLAINANTS = [
  { phone: "9000000001", name: "Anita Verma" },
  { phone: "9000000002", name: "Ramesh Pawar" },
  { phone: "9000000003", name: "Savitri Devi" },
  { phone: "9000000004", name: "Imran Sheikh" },
  { phone: "9000000005", name: "Meena Rathore" },
];

const buildCase = ({
  complainantId,
  language,
  transcript,
  signals,
  evidence,
  incident,
  status,
  assignedOfficerId = null,
  urgentFlag = false,
  submitted,
  sourceChannel = "WEB_PORTAL",
  docketNumber = "",
  incidentType = "UNKNOWN",
  immediateSafety = "UNKNOWN",
  supportNeeds = [],
  assessmentHistory = [],
  voiceFeatures = null,
  events = [],
}) => {
  const svi = computeSvi(signals, evidence);
  const support = buildRecommendations(signals, evidence);
  const safety = toSafetyIndicators(signals);
  const voiceAnalytics = voiceFeatures
    ? {
        features: voiceFeatures,
        observations: interpretVoiceFeatures(voiceFeatures),
        affectObservations: [],
        affectDisclaimer: "",
        source: "CLIENT_FEATURES",
        updatedAt: new Date(),
      }
    : { features: null, observations: [], affectObservations: [] };
  return {
    complainantId,
    language,
    sourceChannel,
    externalReference: { docketNumber },
    consent: {
      granted: true,
      timestamp: new Date(),
      scopes: {
        intakeProcessing: true,
        voiceTranscription: true,
        aiAnalysis: true,
        storage: true,
      },
      voiceNoticeAcknowledged: true,
    },
    transcript,
    incident,
    incidentType,
    immediateSafety,
    supportNeeds,
    vulnerabilitySignals: signals,
    safetyIndicators: safety,
    evidence,
    assessment: { svi, recommendations: support.recommendations },
    assessmentHistory,
    voiceAnalytics,
    urgentFlag,
    status,
    assignedOfficerId,
    submittedAt: submitted ? new Date() : null,
    events,
  };
};

const historyEntry = (turn, score, riskLevel, newSignals = [], voiceAvailable = false, minutesAgo = 0) => ({
  at: new Date(Date.now() - minutesAgo * 60 * 1000),
  turn,
  score,
  riskLevel,
  newSignals,
  voiceAvailable,
});

const assessmentEvent = (score, riskLevel, minutesAgo = 0, noteSuffix = "") => ({
  status: "ASSESSMENT_UPDATED",
  officerName: "",
  note: `Full assessment completed: SVI ${score} (${riskLevel}).${noteSuffix}`,
  at: new Date(Date.now() - minutesAgo * 60 * 1000),
});

export const seedSupportDemoData = async () => {
  if (process.env.SEED_DEMO !== "true") {
    console.log("[Seed] Demo support data skipped (SEED_DEMO !== 'true').");
    return;
  }

  try {
    // 1. Ensure demo complainants exist (mock identities).
    const complainantByPhone = {};
    for (const { phone, name } of DEMO_COMPLAINANTS) {
      let person = await Patient.findOne({ phone });
      if (!person) {
        person = await Patient.create({ phone, name });
      } else if (person.name === "Guest Patient") {
        person.name = name;
        await person.save();
      }
      complainantByPhone[phone] = person;
    }

    // 2. Skip if the demo cases already exist (idempotent on restart).
    const existing = await SupportCase.findOne({});
    if (existing) {
      console.log("[Seed] Support cases already present; skipping demo cases.");
      return;
    }

    // 3. Officers from the seeded HPR registry (phones 1111111111+).
    const officerByPhone = {};
    for (const phone of [
      "1111111111",
      "2222222222",
      "3333333333",
      "4444444444",
      "5555555555",
    ]) {
      const officer = await Doctor.findOne({ phone });
      if (officer) officerByPhone[phone] = officer;
    }

    const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

    const demos = [
      // A. Meena Rathore — LOW, RESOLVED (legal guidance). DEMO DATA.
      buildCase({
        complainantId: complainantByPhone["9000000005"]._id,
        language: "en",
        submitted: true,
        status: "RESOLVED",
        assignedOfficerId: officerByPhone["1111111111"]?._id || null,
        sourceChannel: "WEB_PORTAL",
        docketNumber: "DEMO-2026-001",
        incidentType: "OTHER",
        immediateSafety: "UNKNOWN",
        supportNeeds: ["LEGAL_AID"],
        assessmentHistory: [
          historyEntry(1, 0, "LOW", ["legalAssistanceRequested"], false, 90),
          historyEntry(2, 0, "LOW", [], false, 85),
        ],
        events: [
          assessmentEvent(0, "LOW", 80),
          {
            status: "RESOLVED",
            officerName: "Kavita Deshmukh",
            note: "Legal-aid guidance provided for the land-record correction process.",
            at: daysAgo(1),
          },
        ],
        transcript: [
          { role: "user", content: "There is a mistake in my family's land record and I want to know how to correct it." },
          { role: "model", content: "Thank you for sharing that. Would you like legal guidance on how to correct the record?" },
          { role: "user", content: "Yes, I want to know which office to approach." },
          { role: "model", content: "Noted. We will connect you with legal aid for guidance on the land record correction process." },
        ],
        signals: { legalAssistanceRequested: true },
        evidence: [{ signal: "legalAssistanceRequested", evidence: "I want to know how to correct my family's land record." }],
        incident: { narrative: "Mistake in family land record; the complainant wants legal guidance on the correction process.", category: "legal" },
      }),

      // B. Savitri Devi — MODERATE, ASSIGNED (repeated threats + fear). DEMO DATA.
      buildCase({
        complainantId: complainantByPhone["9000000003"]._id,
        language: "en",
        submitted: true,
        status: "ASSIGNED",
        assignedOfficerId: officerByPhone["2222222222"]?._id || null,
        sourceChannel: "WEB_PORTAL",
        docketNumber: "DEMO-2026-002",
        incidentType: "THREAT_INTIMIDATION",
        immediateSafety: "UNKNOWN",
        supportNeeds: ["LEGAL_AID", "COUNSELLING", "PROTECTION_REVIEW"],
        assessmentHistory: [
          historyEntry(1, 20, "LOW", ["reportedThreats"], false, 70),
          historyEntry(2, 35, "MODERATE", ["severeFear"], false, 65),
          historyEntry(3, 35, "MODERATE", [], false, 60),
        ],
        events: [
          assessmentEvent(35, "MODERATE", 55),
          {
            status: "ASSIGNED",
            officerName: "Arun Malhotra",
            note: "Taken up for threat review and legal-aid linkage.",
            at: daysAgo(0),
          },
        ],
        transcript: [
          { role: "user", content: "My neighbour has been threatening to file a false case against me over the boundary wall." },
          { role: "model", content: "I understand. How long has this been going on?" },
          { role: "user", content: "For over a month. I get very anxious and cannot sleep properly because of the fear." },
          { role: "model", content: "That sounds exhausting. Are you safe currently, and is anyone with you?" },
          { role: "user", content: "Right now it is okay, but the fear stays. I do not know whom to ask for help." },
        ],
        signals: { reportedThreats: true, severeFear: true },
        evidence: [
          { signal: "reportedThreats", evidence: "My neighbour has been threatening to file a false case against me." },
          { signal: "severeFear", evidence: "I get very anxious and cannot sleep properly because of the fear." },
        ],
        incident: { narrative: "Repeated threats from a neighbour over a boundary dispute; complainant reports anxiety and sleeplessness from fear.", category: "threat" },
      }),

      // C. Ramesh Pawar — HIGH, IN_REVIEW (threats + displacement + intimidation). DEMO DATA.
      buildCase({
        complainantId: complainantByPhone["9000000002"]._id,
        language: "en",
        submitted: true,
        status: "IN_REVIEW",
        assignedOfficerId: null,
        sourceChannel: "CHATBOT",
        docketNumber: "DEMO-2026-003",
        incidentType: "DISPLACEMENT",
        immediateSafety: "UNKNOWN",
        supportNeeds: ["SHELTER_REHABILITATION", "COUNSELLING", "HUMAN_REVIEW"],
        assessmentHistory: [
          historyEntry(1, 20, "LOW", ["displacement", "socialIsolation"], false, 50),
          historyEntry(2, 20, "LOW", [], false, 45),
          historyEntry(3, 65, "HIGH", ["severeDistress", "reportedThreats"], false, 40),
        ],
        events: [assessmentEvent(65, "HIGH", 35)],
        transcript: [
          { role: "user", content: "We were forced out of our home last week. We have no relatives here and no money for rent." },
          { role: "model", content: "I am very sorry this happened. Where are you staying right now?" },
          { role: "user", content: "We are on the footpath near the bus stand with our two children. I have no one to call." },
          { role: "model", content: "Thank you for telling me. Do you feel safe where you are right now?" },
          { role: "user", content: "No, I am scared, especially for the children, but I have nowhere to go." },
        ],
        signals: { displacement: true, socialIsolation: true, supportNetworkUnavailable: true, severeDistress: true, reportedThreats: true },
        evidence: [
          { signal: "displacement", evidence: "We were forced out of our home last week." },
          { signal: "socialIsolation", evidence: "We have no relatives here." },
          { signal: "supportNetworkUnavailable", evidence: "I have no one to call and nowhere to go." },
          { signal: "severeDistress", evidence: "I am scared, especially for the children." },
          { signal: "reportedThreats", evidence: "We were forced out of our home." },
        ],
        incident: { narrative: "Family displaced from home with children, no support network, staying unsheltered and fearful.", category: "displacement / threat" },
      }),

      // D. Imran Sheikh — CRITICAL (Hindi, self-harm statement) NEW. DEMO DATA.
      buildCase({
        complainantId: complainantByPhone["9000000004"]._id,
        language: "hi",
        submitted: true,
        status: "NEW",
        assignedOfficerId: null,
        urgentFlag: true,
        sourceChannel: "WEB_PORTAL",
        docketNumber: "DEMO-2026-004",
        incidentType: "OTHER",
        immediateSafety: "UNKNOWN",
        supportNeeds: ["COUNSELLING", "EMERGENCY_SUPPORT", "HUMAN_REVIEW"],
        assessmentHistory: [
          historyEntry(1, 75, "CRITICAL", ["selfHarmStatement", "severeDistress", "socialIsolation"], false, 30),
          historyEntry(2, 75, "CRITICAL", [], false, 25),
        ],
        events: [assessmentEvent(75, "CRITICAL", 20, " Self-harm statement requires immediate human review.")],
        transcript: [
          { role: "user", content: "मैं अकेला हूँ, मेरा कोई नहीं है। घर और नौकरी, सब कुछ खत्म हो गया है। कभी-कभी लगता है बस सब खत्म कर दूँ।" },
          { role: "model", content: "आपने यह मुझसे बाँटा, यह महत्वपूर्ण है। क्या आप अभी सुरक्षित जगह पर हैं?" },
          { role: "user", content: "हाँ, घर पर हूँ, लेकिन बहुत अकेला महसूस करता हूँ। नींद नहीं आती, कुछ अच्छा नहीं लगता।" },
        ],
        signals: { selfHarmStatement: true, severeDistress: true, socialIsolation: true, supportNetworkUnavailable: true },
        evidence: [
          { signal: "selfHarmStatement", evidence: "कभी-कभी लगता है बस सब खत्म कर दूँ (sometimes I feel like ending it all)." },
          { signal: "severeDistress", evidence: "नींद नहीं आती, कुछ अच्छा नहीं लगता (I cannot sleep, nothing feels good)." },
          { signal: "socialIsolation", evidence: "मैं अकेला हूँ, मेरा कोई नहीं है (I am alone, I have no one)." },
          { signal: "supportNetworkUnavailable", evidence: "मेरा कोई नहीं है (there is no one for me)." },
        ],
        incident: { narrative: "Complainant reports severe isolation, loss of home and livelihood, and a self-harm statement.", category: "distress / self-harm" },
      }),

      // E. Anita Verma — CRITICAL (immediate danger, voice call) NEW. DEMO DATA.
      buildCase({
        complainantId: complainantByPhone["9000000001"]._id,
        language: "en",
        submitted: true,
        status: "NEW",
        assignedOfficerId: null,
        urgentFlag: true,
        sourceChannel: "VOICE_CALL",
        docketNumber: "DEMO-2026-005",
        incidentType: "THREAT_INTIMIDATION",
        immediateSafety: "UNSAFE",
        supportNeeds: ["EMERGENCY_SUPPORT", "PROTECTION_REVIEW", "POLICE_REVIEW", "HUMAN_REVIEW"],
        assessmentHistory: [
          historyEntry(1, 85, "CRITICAL", ["immediateDanger", "reportedThreats", "severeFear", "intimidation"], true, 12),
        ],
        voiceFeatures: {
          durationMs: 9000,
          speechRatio: 0.62,
          silenceRatio: 0.38,
          pauseCount: 5,
          meanPauseMs: 620,
          longPauseCount: 1,
          rmsMean: 0.18,
          rmsVariation: 0.09,
          pitchMeanHz: 210,
          pitchStdHz: 55,
          pitchRangeHz: 180,
          speechRateProxy: 2.4,
          spectralCentroidMeanHz: 1450,
        },
        events: [assessmentEvent(85, "CRITICAL", 10, " Immediate danger — escalate without delay.")],
        transcript: [
          { role: "user", content: "He is here right now with a weapon, threatening to kill me and my children. Please help." },
          { role: "model", content: "Your immediate safety may be at risk. This case requires urgent human review." },
        ],
        signals: { immediateDanger: true, reportedThreats: true, severeFear: true, intimidation: true },
        evidence: [
          { signal: "immediateDanger", evidence: "He is here right now with a weapon, threatening to kill me and my children." },
          { signal: "reportedThreats", evidence: "threatening to kill me and my children" },
          { signal: "severeFear", evidence: "Please help." },
          { signal: "intimidation", evidence: "He is here right now with a weapon." },
        ],
        incident: { narrative: "Complainant reports being in present danger — a person with a weapon threatening to kill her and her children.", category: "immediate danger" },
      }),
    ];

    await SupportCase.insertMany(
      demos.map((demo, index) => ({
        ...demo,
        createdAt: daysAgo(demos.length - index),
      })),
    );
    console.log(`[Seed] Seeded ${demos.length} fictional support cases.`);
  } catch (error) {
    console.error("[Seed] Demo support data failed:", error?.message || error);
  }
};