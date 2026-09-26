const RISK_STYLES = {
  CRITICAL: "bg-risk-critical/10 text-risk-critical border-risk-critical/30",
  HIGH: "bg-risk-high/10 text-risk-high border-risk-high/30",
  MODERATE: "bg-risk-moderate/10 text-risk-moderate border-risk-moderate/30",
  LOW: "bg-risk-low/10 text-risk-low border-risk-low/30",
};

export default function RiskBadge({ level = "At-Risk", size = "sm" }) {
  const style = RISK_STYLES[level] || "bg-gray-100 text-gray-700 border-gray-200";
  const pad = size === "lg" ? "px-3.5 py-1.5 text-sm" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={`inline-flex items-center rounded-full border font-bold uppercase tracking-wide ${style} ${pad}`}
    >
      {level === "At-Risk" ? "No Assessment" : level}
    </span>
  );
}