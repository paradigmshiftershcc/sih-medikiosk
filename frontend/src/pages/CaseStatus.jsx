import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import Card from "../components/ui/Card.jsx";
import RiskBadge from "../components/ui/RiskBadge.jsx";
import SupportReferrals from "../components/support/SupportReferrals.jsx";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HeartHandshake,
} from "lucide-react";

const STATUS_LABELS = {
  NEW: "Submitted to Support",
  IN_REVIEW: "Being Reviewed",
  ESCALATED: "Escalated",
  ASSIGNED: "Officer Assigned",
  RESOLVED: "Support Provided",
  CLOSED: "Closed",
};

export default function CaseStatus() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCase = async () => {
      try {
        const { data } = await api.get(`/cases/${caseId}`);
        setData(data);
      } catch (err) {
        console.error("Error fetching case:", err);
        setError(
          err.response?.data?.message || "Failed to load your case.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchCase();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-600">
          {error || "Case not found."}
        </div>
      </div>
    );
  }

  const svi = data.assessment?.svi;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <Card className="space-y-6">
        <div className="border-b pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink">Your Support Case</h1>
            <p className="text-muted text-sm mt-1">
              <span className="font-mono">#{String(data._id).slice(-6).toUpperCase()}</span> ·{" "}
              {new Date(data.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RiskBadge level={svi?.riskLevel} />
            <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {STATUS_LABELS[data.status] || data.status}
            </span>
          </div>
        </div>

        {data.urgentFlag && (
          <div className="bg-risk-critical/10 px-4 py-3 flex items-start gap-2 border border-risk-critical/30 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
            <p className="text-sm text-risk-critical font-semibold">
              Your immediate safety may be at risk. A human support officer is
              reviewing this case urgently.
            </p>
          </div>
        )}

        {data.language && data.language !== "auto" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">
                Language
              </p>
              <p className="text-gray-900 font-semibold uppercase">
                {data.language}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">
                Status
              </p>
              <div className="flex items-center gap-2">
                {data.status === "RESOLVED" || data.status === "CLOSED" ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                ) : (
                  <Clock className="w-4 h-4 text-blue-500" />
                )}
                <span className="text-gray-900 font-semibold">
                  {STATUS_LABELS[data.status] || data.status}
                </span>
              </div>
            </div>
          </div>
        )}

        {data.incident?.narrative && (
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <p className="text-sm font-semibold text-ink mb-2">
              What you shared
            </p>
            <p className="text-sm text-gray-800 leading-relaxed">
              {data.incident.narrative}
            </p>
          </div>
        )}

        {svi?.disclaimer && (
          <p className="text-xs text-muted bg-gray-50 p-4 rounded-xl border border-gray-100">
            {svi.disclaimer}
          </p>
        )}

        {data.assessment?.recommendations?.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-ink mb-2">
              Recommended support
            </p>
            <div className="space-y-1.5">
              {data.assessment.recommendations.map((rec, idx) => (
                <p
                  key={idx}
                  className="text-sm text-gray-800 flex items-start gap-2"
                >
                  <HeartHandshake className="w-4 h-4 text-brand-600 mt-0.5 shrink-0" />
                  <span>
                    <span className="font-medium">{rec.pathway}.</span>{" "}
                    {rec.rationale}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-ink mb-1">
            Assessment status
          </p>
          {svi?.score !== undefined && svi?.score !== null ? (
            <p className="text-sm text-muted">
              Your assessment is complete — urgency{" "}
              <strong className="text-ink">{svi.riskLevel}</strong> (score{" "}
              {svi.score}/100). A human officer reviews every assessment before
              any decision.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Your assessment is still being prepared. Continue sharing, then
              review and submit when you are ready.
            </p>
          )}
        </div>

        {(data.events || []).length > 0 && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <p className="text-sm font-semibold text-ink mb-2">Case timeline</p>
            <div className="space-y-2">
              {data.events.map((event, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-sm">
                  <div className="bg-brand-200 w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" />
                  <p className="text-gray-700">
                    <span className="font-medium">{event.status}</span>
                    {event.note ? <span className="text-muted"> — {event.note}</span> : null}
                    <span className="text-muted block text-xs">
                      {event.at ? new Date(event.at).toLocaleString() : ""}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-ink mb-1">
            Consent information
          </p>
          <p className="text-sm text-muted">
            {data.consent?.granted
              ? `You consented to intake processing${data.consent.timestamp ? ` on ${new Date(data.consent.timestamp).toLocaleDateString()}` : ""}. Your voice was only used to create transcripts you reviewed — raw recordings are never stored.`
              : "No consent is recorded for this case."}
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-ink mb-1">
            What happens next
          </p>
          <p className="text-sm text-muted">
            A human support officer in the NHAA Support Command Center reviews
            your case and connects you with the support you need. You remain in
            control.
          </p>
        </div>
      </Card>

      <SupportReferrals />
    </div>
  );
}