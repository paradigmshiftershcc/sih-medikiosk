export const STATUS_LABELS = {
  NEW: "Submitted to Support",
  IN_REVIEW: "Being Reviewed",
  ESCALATED: "Escalated",
  ASSIGNED: "Officer Assigned",
  RESOLVED: "Support Provided",
  CLOSED: "Closed",
};

export const CHANNEL_LABELS = {
  VOICE_CALL: "Voice call",
  WEB_PORTAL: "Web portal",
  CHATBOT: "Chatbot",
  MOBILE_APP: "Mobile app",
  IVRS: "IVRS",
  OTHER: "Other",
};

export const INCIDENT_LABELS = {
  CASTE_DISCRIMINATION: "Caste discrimination",
  PHYSICAL_VIOLENCE: "Physical violence",
  SEXUAL_VIOLENCE: "Sexual violence",
  THREAT_INTIMIDATION: "Threat / intimidation",
  SOCIAL_BOYCOTT: "Social boycott",
  DISPLACEMENT: "Displacement",
  FAMILY_DEATH: "Family death",
  LEGAL_PROCEEDING_DISTRESS: "Legal-proceeding distress",
  OTHER: "Other",
  UNKNOWN: "Unknown",
};

export const SAFETY_LABELS = { SAFE: "Safe", UNSAFE: "Unsafe", UNKNOWN: "Unknown" };

export const shortId = (id) => (id ? String(id).slice(-6).toUpperCase() : "—");

export const fmtDate = (value) =>
  value
    ? new Date(value).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export const fmtDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");
