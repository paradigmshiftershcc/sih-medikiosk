import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import RiskBadge from "../../components/ui/RiskBadge.jsx";
import EmptyState from "../../components/cases/EmptyState.jsx";
import {
  ChevronRight,
  Loader2,
  Users,
  AlertTriangle,
  AlertCircle,
  Filter,
} from "lucide-react";
import { CHANNEL_LABELS, INCIDENT_LABELS } from "../../lib/caseMeta.js";

const GROUPS = ["CRITICAL", "HIGH", "MODERATE", "LOW"];

// Priority Queue: the full active queue grouped by risk band, preserving the
// existing priority ordering (CRITICAL → immediate danger → self-harm →
// HIGH → newest) with officer filters.
export default function PriorityQueue() {
  const navigate = useNavigate();
  const { queue, loading, error } = useOfficerQueue();
  const [filters, setFilters] = useState({
    risk: "ALL",
    status: "ALL",
    channel: "ALL",
    language: "ALL",
    pathway: "ALL",
    incidentType: "ALL",
  });

  const filtered = useMemo(
    () =>
      queue.filter((c) => {
        if (filters.risk !== "ALL" && (c.svi?.riskLevel || "UNKNOWN") !== filters.risk) return false;
        if (filters.status !== "ALL" && c.status !== filters.status) return false;
        if (filters.channel !== "ALL" && (c.sourceChannel || "WEB_PORTAL") !== filters.channel) return false;
        if (filters.language !== "ALL" && (c.language || "en") !== filters.language) return false;
        if (filters.pathway !== "ALL" && !(c.supportNeeds || []).includes(filters.pathway)) return false;
        if (filters.incidentType !== "ALL" && (c.incidentType || "UNKNOWN") !== filters.incidentType) return false;
        return true;
      }),
    [queue, filters],
  );

  const grouped = GROUPS.map((group) => ({
    group,
    cases: filtered.filter((c) => (c.svi?.riskLevel || "At-Risk") === group),
  }));

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const selectClass =
    "bg-white border border-gray-200 rounded-lg text-xs font-medium text-ink px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400 max-w-full";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Priority Queue</h1>
        <p className="text-muted mt-1">Active cases in priority order — click any case for the full assessment.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {!loading && queue.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filters
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <select value={filters.risk} onChange={(e) => setFilter("risk", e.target.value)} className={selectClass} aria-label="Filter by risk">
              {["ALL", ...GROUPS].map((o) => (
                <option key={o} value={o}>Risk: {o}</option>
              ))}
            </select>
            <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)} className={selectClass} aria-label="Filter by status">
              {["ALL", "NEW", "IN_REVIEW", "ESCALATED", "ASSIGNED"].map((o) => (
                <option key={o} value={o}>Status: {o}</option>
              ))}
            </select>
            <select value={filters.channel} onChange={(e) => setFilter("channel", e.target.value)} className={selectClass} aria-label="Filter by channel">
              {["ALL", "VOICE_CALL", "WEB_PORTAL", "CHATBOT", "MOBILE_APP", "IVRS", "OTHER"].map((o) => (
                <option key={o} value={o}>Channel: {o}</option>
              ))}
            </select>
            <select value={filters.language} onChange={(e) => setFilter("language", e.target.value)} className={selectClass} aria-label="Filter by language">
              {["ALL", "auto", "en", "hi", "mr", "gu", "bn"].map((o) => (
                <option key={o} value={o}>Lang: {o}</option>
              ))}
            </select>
            <select value={filters.pathway} onChange={(e) => setFilter("pathway", e.target.value)} className={selectClass} aria-label="Filter by support pathway">
              {["ALL", "EMERGENCY_SUPPORT", "COUNSELLING", "LEGAL_AID", "MEDICAL", "POLICE_REVIEW", "PROTECTION_REVIEW", "SHELTER_REHABILITATION", "HUMAN_REVIEW"].map((o) => (
                <option key={o} value={o}>Pathway: {o}</option>
              ))}
            </select>
            <select value={filters.incidentType} onChange={(e) => setFilter("incidentType", e.target.value)} className={selectClass} aria-label="Filter by incident type">
              {["ALL", ...Object.keys(INCIDENT_LABELS)].map((o) => (
                <option key={o} value={o}>Type: {o}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-10">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title="The priority queue is empty"
          body="Newly submitted complainant cases will appear here in priority order."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No cases match these filters"
          body="Adjust or clear the filters to see more of the queue."
        />
      ) : (
        <div className="space-y-8">
          {grouped.map(({ group, cases }) =>
            cases.length === 0 ? null : (
              <section key={group}>
                <h2 className="text-lg font-bold text-ink flex items-center gap-2 mb-3">
                  <Users className="w-5 h-5 text-brand-600" />
                  {group === "CRITICAL" ? (
                    <span className="text-risk-critical">CRITICAL</span>
                  ) : group === "HIGH" ? (
                    <span className="text-risk-high">HIGH</span>
                  ) : group === "MODERATE" ? (
                    <span className="text-risk-moderate">MODERATE</span>
                  ) : (
                    <span className="text-risk-low">LOW</span>
                  )}
                  <span className="text-muted font-normal text-sm">({cases.length})</span>
                </h2>
                <div className="space-y-3">
                  {cases.map((caseRecord) => (
                    <div
                      key={caseRecord._id}
                      onClick={() => navigate(`/command/case/${caseRecord._id}`)}
                      className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-brand-300 cursor-pointer flex items-center justify-between group transition-all"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-bold text-ink">{caseRecord.complainant?.name || "Complainant"}</h3>
                          {caseRecord.urgentFlag && (
                            <span className="flex items-center gap-1 text-xs font-bold bg-risk-critical/10 text-risk-critical px-2 py-0.5 rounded-full border border-risk-critical/30">
                              <AlertTriangle className="w-3 h-3" /> URGENT
                            </span>
                          )}
                          <RiskBadge level={caseRecord.svi?.riskLevel || "At-Risk"} />
                          <span className="text-[11px] font-medium text-muted uppercase px-2 py-0.5 rounded-full bg-gray-100">
                            {caseRecord.status}
                          </span>
                          {caseRecord.immediateDanger && (
                            <span className="text-[11px] font-bold text-risk-critical uppercase px-2 py-0.5 rounded-full bg-risk-critical/10 border border-risk-critical/30">
                              Immediate danger
                            </span>
                          )}
                          {caseRecord.selfHarm && (
                            <span className="text-[11px] font-bold text-risk-high uppercase px-2 py-0.5 rounded-full bg-risk-high/10 border border-risk-high/30">
                              Self-harm concern
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted line-clamp-1">
                          {caseRecord.incident?.narrative || "Support request"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(caseRecord.submittedAt || caseRecord.createdAt).toLocaleDateString()}
                          {caseRecord.sourceChannel ? ` · ${CHANNEL_LABELS[caseRecord.sourceChannel] || caseRecord.sourceChannel}` : ""}
                          {caseRecord.language && caseRecord.language !== "en" && caseRecord.language !== "auto"
                            ? ` · ${caseRecord.language}` : ""}
                          {caseRecord.incidentType && caseRecord.incidentType !== "UNKNOWN"
                            ? ` · ${INCIDENT_LABELS[caseRecord.incidentType] || caseRecord.incidentType}` : ""}
                          {caseRecord.assignedOfficer
                            ? ` · Assigned to ${caseRecord.assignedOfficer.name}`
                            : " · Unassigned"}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 shrink-0 ml-4" />
                    </div>
                  ))}
                </div>
              </section>
            ),
          )}
        </div>
      )}
    </div>
  );
}
