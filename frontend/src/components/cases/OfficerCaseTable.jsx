import { useNavigate } from "react-router-dom";
import RiskBadge from "../ui/RiskBadge.jsx";
import EmptyState from "./EmptyState.jsx";
import {
  STATUS_LABELS,
  CHANNEL_LABELS,
  INCIDENT_LABELS,
  SAFETY_LABELS,
  shortId,
} from "../../lib/caseMeta.js";

// Shared officer case table. Clicking a row opens the authoritative
// SupportCaseDetail view — no assessment logic is duplicated here.
export default function OfficerCaseTable({ cases, emptyTitle, emptyBody }) {
  const navigate = useNavigate();

  if (!cases.length) {
    return <EmptyState title={emptyTitle} body={emptyBody} />;
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-muted border-b border-gray-100">
              <th className="px-4 py-3 font-semibold">Case ID</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">SVI</th>
              <th className="px-4 py-3 font-semibold">Incident Type</th>
              <th className="px-4 py-3 font-semibold">Channel</th>
              <th className="px-4 py-3 font-semibold">Safety</th>
              <th className="px-4 py-3 font-semibold">Recommended Pathway</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Assigned Officer</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((c) => (
              <tr
                key={c._id}
                onClick={() => navigate(`/command/case/${c._id}`)}
                className="border-b border-gray-50 last:border-0 hover:bg-brand-50/50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 font-mono text-xs text-muted">{shortId(c._id)}</td>
                <td className="px-4 py-3">
                  <RiskBadge level={c.svi?.riskLevel || "At-Risk"} />
                </td>
                <td className="px-4 py-3 font-bold text-ink">
                  {c.svi?.score ?? "—"}
                  {c.urgentFlag && <span className="ml-1 text-risk-critical">•</span>}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {INCIDENT_LABELS[c.incidentType] || "Unknown"}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {CHANNEL_LABELS[c.sourceChannel] || "Web portal"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`font-semibold ${
                      c.immediateSafety === "UNSAFE" ? "text-risk-critical" : "text-gray-700"
                    }`}
                  >
                    {SAFETY_LABELS[c.immediateSafety] || "Unknown"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 max-w-[220px] truncate">
                  {(c.supportNeeds || [])[0]?.replace(/_/g, " ") || "—"}
                </td>
                <td className="px-4 py-3 text-gray-700 text-xs">
                  {STATUS_LABELS[c.status] || c.status}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {c.assignedOfficer?.name || <span className="text-muted">Unassigned</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-muted border-t border-gray-100">
        {cases.length} case{cases.length === 1 ? "" : "s"} · sorted by priority (CRITICAL → immediate danger → self-harm → HIGH → newest)
      </p>
    </div>
  );
}
