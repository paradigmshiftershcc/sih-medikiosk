import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import ChatInterface from "../components/intake/ChatInterface.jsx";
import ConsentScreen from "../components/intake/ConsentScreen.jsx";
import AssessmentReview from "../components/intake/AssessmentReview.jsx";
import api from "../services/api.js";

export default function IntakeFlow() {
  const navigate = useNavigate();

  const [consent, setConsent] = useState(null);
  const [language, setLanguage] = useState("auto");
  const [caseId, setCaseId] = useState(null);
  const [step, setStep] = useState("consent"); // consent | chat | assess
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [assessError, setAssessError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const handleConsent = async (consentResult) => {
    try {
      const { data } = await api.post("/cases", {
        language: consentResult.language,
        sourceChannel: "WEB_PORTAL",
        consent: {
          granted: true,
          scopes: consentResult.scopes,
          voiceNoticeAcknowledged: consentResult.voiceNoticeAcknowledged,
        },
      });
      setConsent(consentResult);
      setLanguage(consentResult.language);
      setCaseId(data.caseId);
      setStep("chat");
    } catch (error) {
      setAssessError(
        error.response?.data?.message ||
          "Could not start the session. Please try again.",
      );
    }
  };

  const handleFinishReview = async (finalCaseId) => {
    if (!finalCaseId) return;
    setIsAssessing(true);
    setAssessError("");
    try {
      const { data } = await api.post(`/cases/${finalCaseId}/assess`);
      setAssessment(data);
      setStep("assess");
    } catch (error) {
      setAssessError(
        error.response?.data?.message ||
          "Failed to prepare your assessment. Please try again.",
      );
    } finally {
      setIsAssessing(false);
    }
  };

  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError("");
    try {
      await api.post(`/cases/${caseId}/submit`);
      navigate(`/cases/${caseId}`);
    } catch (error) {
      setSubmitError(
        error.response?.data?.message ||
          "Failed to submit your case. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  const stepLabel = () => {
    if (step === "consent") return "Step 0: Consent & Privacy";
    if (step === "chat") return "Step 1: Share in your own words";
    return "Step 2: Review & Submit";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          title="Return to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-muted" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink">Share What Happened</h1>
          <p className="text-sm text-muted">{stepLabel()}</p>
        </div>
      </div>

      {assessError && step === "consent" && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
          {assessError}
        </div>
      )}

      {step === "consent" && <ConsentScreen onConsent={handleConsent} />}

      {step === "chat" && consent && caseId && (
        <ChatInterface
          caseId={caseId}
          language={language}
          onLanguageChange={setLanguage}
          onComplete={handleFinishReview}
          voiceAllowed={consent.scopes?.voiceTranscription !== false}
        />
      )}

      {step === "chat" && isAssessing && (
        <div className="flex flex-col items-center justify-center min-h-[40vh] space-y-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-muted font-medium">
            Preparing your support assessment...
          </p>
        </div>
      )}

      {step === "chat" && assessError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm">
          {assessError}
        </div>
      )}

      {step === "assess" && assessment && (
        <AssessmentReview
          assessment={assessment}
          onConfirm={handleConfirmSubmit}
          onBack={() => setStep("chat")}
          isSubmitting={isSubmitting}
          submitError={submitError}
        />
      )}
    </div>
  );
}