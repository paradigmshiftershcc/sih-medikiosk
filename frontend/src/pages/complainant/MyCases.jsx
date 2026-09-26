import { useNavigate } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useMyCases } from "../../hooks/useMyCases.js";
import ComplainantCaseCard from "../../components/cases/ComplainantCaseCard.jsx";
import EmptyState from "../../components/cases/EmptyState.jsx";

export default function MyCases() {
  const navigate = useNavigate();
  const { cases, loading, error } = useMyCases();

  const sorted = [...cases].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">My Cases</h1>
        <p className="text-muted mt-1">Every assessment you have shared, newest first.</p>
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
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No cases yet"
          body="You have not shared anything yet. Start an assessment whenever you are ready — you stay in control throughout."
          action={
            <button
              onClick={() => navigate("/intake")}
              className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              Start New Assessment
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((record) => (
            <ComplainantCaseCard key={record._id} record={record} />
          ))}
        </div>
      )}
    </div>
  );
}
