import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useMyCases } from "../hooks/useMyCases.js";
import ComplainantCaseCard from "../components/cases/ComplainantCaseCard.jsx";
import EmptyState from "../components/cases/EmptyState.jsx";
import SupportReferrals from "../components/support/SupportReferrals";
import {
  AlertCircle,
  Loader2,
  FolderOpen,
  ClipboardCheck,
  Hourglass,
  HeartHandshake,
  Radar,
  LifeBuoy,
} from "lucide-react";

export default function ComplainantDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { cases, loading, error } = useMyCases();

  const displayName =
    user?.name && !user.name.startsWith("Guest") ? `, ${user.name}` : "";
  const active = cases.filter((c) => !["RESOLVED", "CLOSED"].includes(c.status));
  const assessed = cases.filter((c) => c.assessment?.svi?.score !== undefined && c.assessment?.svi?.score !== null);
  const drafts = cases.filter((c) => !c.submittedAt);
  const recent = [...cases]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 5);

  const cards = [
    { label: "Active Cases", value: active.length, icon: FolderOpen, hint: "In review or open" },
    { label: "Total Assessments", value: assessed.length, icon: ClipboardCheck, hint: "Completed SVI reviews" },
    { label: "Pending Actions", value: drafts.length, icon: Hourglass, hint: "Unsubmitted drafts to finish" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Welcome back{displayName}</h1>
        <p className="text-muted mt-1">
          You can type or speak in your language. You decide what to share, and
          you can stop at any time.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{card.label}</p>
              <card.icon className="w-5 h-5 text-brand-600" />
            </div>
            <p className="text-3xl font-bold text-ink mt-1">
              {loading ? <Loader2 className="w-6 h-6 animate-spin text-brand-500" /> : card.value}
            </p>
            <p className="text-xs text-muted mt-1">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => navigate("/intake")}
          className="flex items-center gap-3 bg-brand-600 text-white p-4 rounded-2xl shadow-sm hover:bg-brand-700 transition-colors text-left"
        >
          <HeartHandshake className="w-6 h-6 shrink-0" />
          <span>
            <span className="block font-bold">Start New Assessment</span>
            <span className="block text-brand-100 text-xs">Share what happened</span>
          </span>
        </button>
        <button
          onClick={() => navigate("/cases")}
          className="flex items-center gap-3 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:border-brand-300 transition-colors text-left"
        >
          <Radar className="w-6 h-6 text-brand-600 shrink-0" />
          <span>
            <span className="block font-bold text-ink">Track Existing Case</span>
            <span className="block text-muted text-xs">Status, timeline & updates</span>
          </span>
        </button>
        <button
          onClick={() => navigate("/support")}
          className="flex items-center gap-3 bg-white border border-gray-100 p-4 rounded-2xl shadow-sm hover:border-brand-300 transition-colors text-left"
        >
          <LifeBuoy className="w-6 h-6 text-brand-600 shrink-0" />
          <span>
            <span className="block font-bold text-ink">Get Support</span>
            <span className="block text-muted text-xs">Helplines & referrals</span>
          </span>
        </button>
      </div>

      {/* Recent cases */}
      <section aria-labelledby="recent-cases-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="recent-cases-heading" className="text-lg font-semibold text-ink">
            Recent Cases
          </h2>
          {cases.length > 5 && (
            <button onClick={() => navigate("/cases")} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              View all ({cases.length})
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No cases yet"
            body="When you start an assessment, your cases will appear here with their status and review progress."
            action={
              <button
                onClick={() => navigate("/intake")}
                className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
              >
                Start your first assessment
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {recent.map((record) => (
              <ComplainantCaseCard key={record._id} record={record} />
            ))}
          </div>
        )}
      </section>

      <SupportReferrals />
    </div>
  );
}
