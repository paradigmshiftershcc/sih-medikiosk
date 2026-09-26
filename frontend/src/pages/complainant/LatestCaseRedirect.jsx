import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useMyCases } from "../../hooks/useMyCases.js";
import EmptyState from "../../components/cases/EmptyState.jsx";

// "Case Status" nav target: opens the most recently updated case, or a
// polished empty state when the complainant has no cases yet.
export default function LatestCaseRedirect() {
  const navigate = useNavigate();
  const { cases, loading } = useMyCases();

  useEffect(() => {
    if (loading || cases.length === 0) return;
    const latest = [...cases].sort(
      (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt),
    )[0];
    navigate(`/cases/${latest._id}`, { replace: true });
  }, [loading, cases, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <EmptyState
      title="No case to show yet"
      body="Your latest case status will open here automatically once you have shared something."
      action={
        <button
          onClick={() => navigate("/intake")}
          className="px-5 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Start New Assessment
        </button>
      }
    />
  );
}
