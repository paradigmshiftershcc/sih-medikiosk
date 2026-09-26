import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Bell } from "lucide-react";
import api from "../../services/api.js";
import EmptyState from "../../components/cases/EmptyState.jsx";
import { fmtDateTime, shortId } from "../../lib/caseMeta.js";

// Messages / Updates: real review activity on the complainant's own cases
// (status changes, assessment updates, officer notes), newest first.
export default function UpdatesPage() {
  const navigate = useNavigate();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data: list } = await api.get("/cases");
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
              at: event.at,
              status: event.status,
              officerName: event.officerName,
              note: event.note,
            });
          }
        }
        merged.sort((a, b) => new Date(b.at) - new Date(a.at));
        if (!cancelled) setUpdates(merged);
      } catch (err) {
        console.error("Failed to load updates:", err);
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
          <Bell className="w-6 h-6 text-brand-600" /> Messages / Updates
        </h1>
        <p className="text-muted mt-1">Review activity on your cases, newest first.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        </div>
      ) : updates.length === 0 ? (
        <EmptyState
          title="No updates yet"
          body="When a support officer reviews, assigns, or updates one of your cases, it will appear here."
        />
      ) : (
        <div className="space-y-2">
          {updates.map((u, i) => (
            <button
              key={i}
              onClick={() => navigate(`/cases/${u.caseId}`)}
              className="w-full text-left bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm hover:border-brand-300 transition-colors"
            >
              <div className="flex items-start gap-3 text-sm">
                <div className="bg-brand-100 w-2 h-2 rounded-full mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-gray-700">
                    <span className="font-semibold text-ink">{u.status}</span>
                    <span className="text-muted"> · Case #{shortId(u.caseId)}</span>
                    {u.officerName ? <span className="text-muted"> · {u.officerName}</span> : null}
                  </p>
                  {u.note && <p className="text-muted text-[13px] mt-0.5">{u.note}</p>}
                  <p className="text-[11px] text-gray-400 mt-0.5">{fmtDateTime(u.at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
