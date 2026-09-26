import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, ScrollText } from "lucide-react";
import api from "../../services/api.js";
import EmptyState from "../../components/cases/EmptyState.jsx";
import { fmtDateTime, shortId } from "../../lib/caseMeta.js";

// Audit Trail: merged review timeline across submitted cases (newest first).
// Built from real case events; each row links to the authoritative detail.
export default function AuditPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: list } = await api.get("/queue?scope=all");
        const details = await Promise.all(
          (Array.isArray(list) ? list : []).map((c) =>
            api.get(`/cases/${c._id}`).then(({ data }) => data).catch(() => null),
          ),
        );
        const merged = [];
        for (const detail of details) {
          if (!detail) continue;
          for (const event of detail.events || []) {
            merged.push({
              caseId: detail._id,
              complainant: detail.complainant?.name || "Complainant",
              status: event.status,
              officerName: event.officerName,
              note: event.note,
              at: event.at,
            });
          }
        }
        merged.sort((a, b) => new Date(b.at) - new Date(a.at));
        if (!cancelled) setEvents(merged);
      } catch (err) {
        console.error("Audit load error:", err);
        if (!cancelled) setError("Could not load the audit trail.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-brand-600" /> Audit Trail
        </h1>
        <p className="text-muted mt-1">Every recorded human and system action across cases, newest first.</p>
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
      ) : events.length === 0 ? (
        <EmptyState
          title="No audit events yet"
          body="Status changes, assignments, assessments, and officer notes will be recorded here."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="space-y-2">
            {events.map((event, i) => (
              <button
                key={i}
                onClick={() => navigate(`/command/case/${event.caseId}`)}
                className="w-full text-left flex items-start gap-3 text-sm hover:bg-brand-50/50 rounded-xl px-2 py-1.5 transition-colors"
              >
                <div className="bg-brand-100 w-2 h-2 rounded-full mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-700">
                    <span className="font-semibold text-ink">{event.status}</span>{" "}
                    by <span className="font-medium">{event.officerName || "System"}</span>
                    <span className="text-muted"> · {event.complainant} (#{shortId(event.caseId)})</span>
                  </p>
                  {event.note && <p className="text-muted text-[13px]">{event.note}</p>}
                  <p className="text-[11px] text-gray-400">{fmtDateTime(event.at)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
