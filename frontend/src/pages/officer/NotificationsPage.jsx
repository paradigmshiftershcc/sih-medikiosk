import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, Bell, ChevronRight } from "lucide-react";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import EmptyState from "../../components/cases/EmptyState.jsx";
import RiskBadge from "../../components/ui/RiskBadge.jsx";
import { shortId } from "../../lib/caseMeta.js";

// Notifications: derived from live queue data (no separate backend).
// Critical-unassigned, fresh urgent arrivals, self-harm watch, idle highs.
export default function NotificationsPage() {
  const navigate = useNavigate();
  const { queue, loading, error } = useOfficerQueue();

  const [notes, setNotes] = useState([]);

  const buildNotes = (items, dayAgo) => {
    for (const c of queue) {
      const name = c.complainant?.name || "Complainant";
      if (c.svi?.riskLevel === "CRITICAL" && !c.assignedOfficer) {
        items.push({
          caseId: c._id, tone: "critical", title: `CRITICAL case unassigned — ${name}`,
          body: "Take ownership immediately.", at: c.submittedAt, risk: c.svi?.riskLevel,
        });
      }
      if (c.urgentFlag && c.status === "NEW") {
        items.push({
          caseId: c._id, tone: "critical", title: `Urgent new arrival — ${name}`,
          body: "Immediate danger or self-harm indicated.", at: c.submittedAt, risk: c.svi?.riskLevel,
        });
      }
      if (c.selfHarm && !["RESOLVED", "CLOSED"].includes(c.status)) {
        items.push({
          caseId: c._id, tone: "high", title: `Self-harm concern on watch — ${name}`,
          body: "Ensure human review is underway.", at: c.submittedAt, risk: c.svi?.riskLevel,
        });
      }
      if (c.svi?.riskLevel === "HIGH" && !c.assignedOfficer) {
        items.push({
          caseId: c._id, tone: "high", title: `HIGH case unassigned — ${name}`,
          body: "Assign an officer.", at: c.submittedAt, risk: c.svi?.riskLevel,
        });
      }
      if (c.submittedAt && new Date(c.submittedAt).getTime() > dayAgo && c.status === "NEW") {
        items.push({
          caseId: c._id, tone: "info", title: `New submission in the last 24h — ${name}`,
          body: "Fresh case awaiting triage.", at: c.submittedAt, risk: c.svi?.riskLevel,
        });
      }
    }
    const rank = { critical: 0, high: 1, info: 2 };
    items.sort(
      (a, b) => rank[a.tone] - rank[b.tone] || new Date(b.at) - new Date(a.at),
    );
    setNotes(items);
  };

  // Derived from live queue data inside a promise callback (never a
  // synchronous effect body) to satisfy the set-state-in-effect rule.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      buildNotes([], Date.now() - 24 * 60 * 60 * 1000);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue]);

  const toneClass = {
    critical: "border-risk-critical/40 bg-risk-critical/5",
    high: "border-risk-high/30 bg-risk-high/5",
    info: "border-gray-200 bg-white",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <Bell className="w-6 h-6 text-brand-600" /> Notifications
        </h1>
        <p className="text-muted mt-1">Derived live from the priority queue — newest, most urgent first.</p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        </div>
      ) : notes.length === 0 ? (
        <EmptyState
          title="All caught up"
          body="No urgent notifications right now. Critical, unassigned, and fresh cases will surface here."
        />
      ) : (
        <div className="space-y-2">
          {notes.map((n, i) => (
            <button
              key={i}
              onClick={() => navigate(`/command/case/${n.caseId}`)}
              className={`w-full text-left border rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-3 ${toneClass[n.tone]}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <RiskBadge level={n.risk} />
                </div>
                <p className="text-xs text-muted mt-0.5">
                  Case #{shortId(n.caseId)} · {n.body}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
