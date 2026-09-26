// Sahaay — rule-based support pathway recommendations for a support case.
//
// The routing is fully deterministic and derived ONLY from the extracted,
// evidence-backed vulnerability signals. The prototype never contacts
// authorities or third parties automatically; every pathway is a
// recommendation for authorized human personnel to act on.
//
// Each recommendation is an explicit pathway object:
//   { code, pathway, reason, rationale, triggerEvidence[], priority,
//     humanReviewRequired }
// priority 1 = most urgent. humanReviewRequired is ALWAYS true.

const RULES = [
  {
    detect: (s) => Boolean(s.immediateDanger),
    recommendations: [
      {
        code: "HUMAN_ESCALATION",
        pathway: "Immediate human escalation",
        reason:
          "Immediate danger reported — a duty officer must review the case without delay.",
        priority: 1,
        evidenceSignals: ["immediateDanger"],
      },
      {
        code: "EMERGENCY_SUPPORT",
        pathway: "Emergency / police review",
        reason:
          "The complainant reports being in present danger. Contacting emergency services (for example ERSS 112) or law enforcement is a human decision inside the escalation protocol.",
        priority: 1,
        evidenceSignals: ["immediateDanger", "reportedThreats"],
      },
      {
        code: "PROTECTION_REVIEW",
        pathway: "Protection review",
        reason:
          "Immediate danger reported — assess eligibility and need for victim or witness protection, safety planning, or relocation through the appropriate authority. Sahaay itself does not grant protection.",
        priority: 1,
        evidenceSignals: ["immediateDanger", "reportedThreats", "intimidation"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.selfHarmStatement),
    recommendations: [
      {
        code: "HUMAN_ESCALATION",
        pathway: "Immediate human escalation",
        reason:
          "Self-harm or suicidal statement recorded — urgent human review required.",
        priority: 1,
        evidenceSignals: ["selfHarmStatement"],
      },
      {
        code: "EMERGENCY_SUPPORT",
        pathway: "Emergency / mental-health support referral",
        reason:
          "Connect the complainant to available emergency and mental-health support (for example Tele-MANAS 14416) for review by a qualified human professional.",
        priority: 1,
        evidenceSignals: ["selfHarmStatement", "immediateDanger"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.severeFear) || Boolean(s.severeDistress),
    recommendations: [
      {
        code: "COUNSELLING",
        pathway: "Counselling / mental-health professional review",
        reason:
          "Severe fear or distress reported — offer counselling and mental-health support review.",
        priority: 2,
        evidenceSignals: ["severeFear", "severeDistress"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.reportedThreats) || Boolean(s.intimidation),
    recommendations: [
      {
        code: "LEGAL_AID",
        pathway: "Legal aid referral",
        reason:
          "Threats or intimidation reported — refer for legal-aid assistance (for example NALSA 15100) through human review.",
        priority: 2,
        evidenceSignals: ["reportedThreats", "intimidation"],
      },
      {
        code: "POLICE_REVIEW",
        pathway: "Police review / protection assessment",
        reason:
          "Threats or intimidation reported — protection measures should be assessed by the authorities through human review.",
        priority: 2,
        evidenceSignals: ["reportedThreats", "intimidation"],
      },
      {
        code: "PROTECTION_REVIEW",
        pathway: "Protection review",
        reason:
          "Threats, intimidation, or coercion reported — assess eligibility and need for victim or witness protection or relocation through the appropriate authority.",
        priority: 2,
        evidenceSignals: ["reportedThreats", "intimidation"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.socialIsolation) || Boolean(s.supportNetworkUnavailable),
    recommendations: [
      {
        code: "WELFARE_SUPPORT",
        pathway: "Welfare / community support assessment",
        reason:
          "No support network identified — assess welfare and community support options.",
        priority: 3,
        evidenceSignals: ["socialIsolation", "supportNetworkUnavailable"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.displacement),
    recommendations: [
      {
        code: "SHELTER_REHABILITATION",
        pathway: "Shelter / rehabilitation support",
        reason:
          "Displacement or homelessness reported — connect to shelter and rehabilitation support.",
        priority: 2,
        evidenceSignals: ["displacement"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.medicalConcern),
    recommendations: [
      {
        code: "MEDICAL_ASSISTANCE",
        pathway: "Medical assistance",
        reason: "A medical concern was mentioned — refer for a medical check.",
        priority: 2,
        evidenceSignals: ["medicalConcern"],
      },
    ],
  },
  {
    detect: (s) => Boolean(s.legalAssistanceRequested),
    recommendations: [
      {
        code: "LEGAL_AID",
        pathway: "Legal aid referral",
        reason: "The complainant explicitly requested legal assistance.",
        priority: 2,
        evidenceSignals: ["legalAssistanceRequested"],
      },
    ],
  },
];

export const HUMAN_REVIEW_NOTE =
  "AI-assisted triage. Final decisions remain with authorized human personnel. The prototype never contacts authorities automatically.";

// External government support routes shown as REFERRAL information only.
// Sahaay recommends; a human makes any contact. Never auto-called.
export const GOVERNMENT_REFERRALS = [
  {
    name: "NHAA — National Helpline Against Atrocities",
    number: "14566",
    description: "24x7 toll-free helpline for atrocity complaints and case tracking.",
    type: "EXTERNAL_REFERRAL",
  },
  {
    name: "ERSS — Emergency Response Support System",
    number: "112",
    description: "Single all-in-one emergency number (police, fire, ambulance).",
    type: "EXTERNAL_REFERRAL",
  },
  {
    name: "Tele-MANAS — Tele Mental Health Assistance",
    number: "14416",
    description: "24/7 free tele-counselling and mental-health support.",
    type: "EXTERNAL_REFERRAL",
  },
  {
    name: "NALSA — Free Legal Aid Helpline",
    number: "15100",
    description: "Toll-free legal aid, advice, and legal-services linkage.",
    type: "EXTERNAL_REFERRAL",
  },
];

const evidenceTextFor = (evidence = [], signals = []) => {
  const wanted = new Set(signals);
  return (evidence || [])
    .filter((item) => wanted.has(item?.signal) && item?.evidence)
    .map((item) => item.evidence);
};

export const buildRecommendations = (signals = {}, evidence = []) => {
  const recommendations = [];
  const seen = new Set();

  RULES.forEach((rule) => {
    if (!rule.detect(signals)) return;
    rule.recommendations.forEach((rec) => {
      if (seen.has(rec.code)) return;
      seen.add(rec.code);
      recommendations.push({
        code: rec.code,
        pathway: rec.pathway,
        reason: rec.reason,
        // rationale kept for backward compatibility with existing clients.
        rationale: rec.reason,
        triggerEvidence: evidenceTextFor(evidence, rec.evidenceSignals),
        priority: rec.priority,
        humanReviewRequired: true,
      });
    });
  });

  recommendations.sort((a, b) => a.priority - b.priority);

  return {
    recommendations,
    note: HUMAN_REVIEW_NOTE,
  };
};
