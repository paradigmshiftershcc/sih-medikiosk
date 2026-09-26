import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import OfficerCaseTable from "../../components/cases/OfficerCaseTable.jsx";
import EmptyState from "../../components/cases/EmptyState.jsx";
import { ShieldAlert, Loader2, ArrowRight } from "lucide-react";

export default function OfficerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { queue, loading, error } = useOfficerQueue();

  const summary = useMemo(() => {
    const count = (fn) => queue.filter(fn).length;
    return {
      critical: count((c) => c.svi?.riskLevel === "CRITICAL"),
      high: count((c) => c.svi?.riskLevel === "HIGH"),
      moderate: count((c) => c.svi?.riskLevel === "MODERATE"),
      low: count((c) => c.svi?.riskLevel === "LOW"),
      immediateDanger: count((c) => c.immediateDanger),
      selfHarm: count((c) => c.selfHarm),
      protection: count((c) => (c.supportNeeds || []).includes("PROTECTION_REVIEW")),
      counselling: count((c) => (c.supportNeeds || []).includes("COUNSELLING")),
      legalAid: count((c) => (c.supportNeeds || []).includes("LEGAL_AID")),
    };
  }, [queue]);

  const topCases = queue.slice(0, 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-ink">NHAA Support Command Center</h1>
          <p className="text-muted font-medium mt-0.5">
            {user?.name} · {user?.department || user?.specialty}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
          <ShieldAlert className="w-4 h-4" /> AI-assisted triage · final decisions are human
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl">{error}</div>}

      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title="Queue is clear"
          body="No cases are waiting for review right now. Newly submitted complainant cases will appear here in priority order."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Critical", value: summary.critical, tone: "text-risk-critical" },
              { label: "High", value: summary.high, tone: "text-risk-high" },
              { label: "Moderate", value: summary.moderate, tone: "text-risk-moderate" },
              { label: "Low", value: summary.low, tone: "text-risk-low" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <p className={`text-3xl font-bold ${s.tone}`}>{s.value}</p>
                <p className="text-xs text-muted font-semibold uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["Immediate danger", summary.immediateDanger],
              ["Self-harm concern", summary.selfHarm],
              ["Protection review", summary.protection],
              ["Counselling needed", summary.counselling],
              ["Legal aid needed", summary.legalAid],
            ].map(([label, value]) => (
              <span key={label} className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                {label}: {value}
              </span>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-ink">Priority Cases</h2>
              <button
                onClick={() => navigate("/command/queue")}
                className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Full queue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <OfficerCaseTable
              cases={topCases}
              emptyTitle="No priority cases"
              emptyBody="The queue is clear."
            />
          </div>
        </>
      )}
    </div>
  );
}
