import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  ArrowLeft,
  Loader2,
  HeartHandshake,
} from "lucide-react";
import RiskBadge from "../ui/RiskBadge";
import Button from "../ui/Button";

// Complainant-facing review of the AI-assisted vulnerability assessment.
// The score is deterministic (SVI engine); the AI only extracts evidence.
export default function AssessmentReview({
  assessment,
  onConfirm,
  onBack,
  isSubmitting = false,
  submitError = "",
}) {
  const { incident, safetyIndicators, evidence, svi, recommendations, reviewNote, needsImmediateHumanReview, degraded } = assessment || {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-50 rounded-xl">
            <ClipboardList className="w-6 h-6 text-brand-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink">Your Support Assessment</h2>
            <p className="text-sm text-muted">
              What we understood and the support we suggest
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <RiskBadge level={svi?.riskLevel} size="lg" />
          {svi?.score !== undefined && svi?.score !== null && (
            <div className="text-right">
              <p className="text-2xl font-bold text-ink leading-none">{svi.score}</p>
              <p className="text-[10px] uppercase tracking-wide text-muted">SVI score</p>
            </div>
          )}
        </div>
      </div>

      {degraded && (
        <div className="bg-amber-50 px-4 py-3 flex items-start gap-2 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 font-semibold">
            AI analysis unavailable — deterministic safety analysis active.
            Urgent signals were still checked by fixed safety rules.
          </p>
        </div>
      )}

      {needsImmediateHumanReview && (
        <div className="bg-risk-critical/10 px-4 py-3 flex items-start gap-2 border border-risk-critical/30 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
          <p className="text-sm text-risk-critical font-semibold">
            Your immediate safety may be at risk. This case requires urgent
            human review.
          </p>
        </div>
      )}

      {svi?.disclaimer && (
        <p className="text-xs text-muted bg-white border border-gray-100 rounded-xl px-4 py-3">
          {svi.disclaimer}
        </p>
      )}

      {incident?.narrative && (
        <div className="bg-white rounded-2xl border border-brand-100 p-5">
          <h3 className="text-sm font-semibold text-ink mb-2">What you shared</h3>
          <p className="text-sm text-gray-700 leading-relaxed">{incident.narrative}</p>
        </div>
      )}

      {safetyIndicators?.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-100 p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Safety &amp; vulnerability indicators</h3>
          <div className="flex flex-wrap gap-2">
            {safetyIndicators.map((indicator) => (
              <span
                key={indicator}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-brand-600" />
                {indicator}
              </span>
            ))}
          </div>
        </div>
      )}

      {evidence?.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-100 p-5">
          <h3 className="text-sm font-semibold text-ink mb-2">Basis (what you said)</h3>
          <ul className="space-y-1.5 text-sm text-gray-700">
            {evidence.map((item, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-brand-600">{item.signal}:</span>
                <span className="text-gray-600">{item.evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recommendations?.length > 0 && (
        <div className="bg-white rounded-2xl border border-brand-100 p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">Support we recommend</h3>
          <div className="space-y-2">
            {recommendations.map((rec, index) => (
              <div
                key={index}
                className="flex items-start gap-2 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100"
              >
                <HeartHandshake className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-ink">{rec.pathway}</p>
                  <p className="text-xs text-muted mt-0.5">{rec.rationale}</p>
                </div>
              </div>
            ))}
          </div>
          {reviewNote && (
            <p className="text-xs text-muted mt-3">{reviewNote}</p>
          )}
        </div>
      )}

      {submitError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">{submitError}</div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex items-center gap-2 flex-1 justify-center"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Keep Sharing
        </Button>
        <Button
          onClick={onConfirm}
          disabled={isSubmitting}
          className="flex items-center gap-2 flex-1 justify-center"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" /> Confirm &amp; Submit to Support
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted text-center">
        A human support officer reviews every assessment in the NHAA Support
        Command Center before any decision is made.
      </p>
    </div>
  );
}