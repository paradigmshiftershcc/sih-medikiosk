import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ChatInterface from "../components/intake/ChatInterface.jsx";
import ConsentScreen from "../components/intake/ConsentScreen.jsx";
import DocumentUpload from "../components/intake/DocumentUpload.jsx";
import AyushQuestionnaire from "../components/intake/AyushQuestionnaire.jsx";
import RogiPatrika from "../components/intake/RogiPatrika.jsx";
import api from "../services/api.js";

export default function IntakeFlow() {
  const navigate = useNavigate();
  const location = useLocation();

  // Retrieve the AYUSH mode preference passed from the Dashboard
  const isAyush = location.state?.ayushMode || false;

  // Consent is captured before any health data is recorded (DPDP).
  const [consent, setConsent] = useState(null);

  // Manage Wizard State:
  // 1 = Chat, 2 = Document Upload, 3 = AYUSH (Conditional), 4 = Review
  const [step, setStep] = useState(1);
  const [caseId, setCaseId] = useState(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizationError, setFinalizationError] = useState("");

  const handleChatComplete = (finalCaseId) => {
    if (!finalCaseId) {
      console.error("Missing caseId from chat completion!");
      return;
    }
    setCaseId(finalCaseId);
    setStep(2);
  };

  const completeAndExit = async () => {
    setIsFinalizing(true);
    setFinalizationError("");
    try {
      await api.post(`/intake/${caseId}/complete`);
      navigate("/consultation/" + caseId, { state: { caseCompleted: true } });
    } catch (error) {
      console.error("Failed to finalize case", error);
      setFinalizationError(
        error.response?.data?.message ||
          "Failed to complete case. Please try again.",
      );
      setIsFinalizing(false);
    }
  };

  const handleDocumentComplete = () => {
    if (isAyush) {
      setStep(3);
    } else {
      // Skip straight to the patient review (no AYUSH profiling)
      setStep(4);
    }
  };

  const handleAyushComplete = () => {
    setStep(4);
  };

  const handleReviewBack = () => {
    // Return to the last data-capture step so edits regenerate the summary
    if (isAyush) {
      setStep(3);
    } else {
      setStep(2);
    }
  };

  if (isFinalizing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        <h2 className="text-xl font-bold text-gray-800">Assigning Doctor...</h2>
        <p className="text-gray-500">Preparing your clinical file.</p>
        {finalizationError && (
          <div className="text-red-600 text-sm mt-4">{finalizationError}</div>
        )}
      </div>
    );
  }

  if (!consent) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              New Consultation
            </h1>
            <p className="text-sm text-gray-500">
              Step 0: Consent &amp; Privacy
            </p>
          </div>
        </div>
        <ConsentScreen onConsent={setConsent} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Navigation / Progress Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          title="Return to Dashboard"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">New Consultation</h1>
          <p className="text-sm text-gray-500">
            {step === 1 && "Step 1: Clinical History"}
            {step === 2 && "Step 2: Upload Documents"}
            {step === 3 && "Step 3: Dashavidha Pariksha (Ayurvedic Profiling)"}
            {step === 4 && "Step 4: Review & Confirm"}
          </p>
        </div>
      </div>

      {/* Render Current Step */}
      {step === 1 && (
        <ChatInterface
          ayushMode={isAyush}
          onComplete={handleChatComplete}
          informant={consent.informant}
          consentGiven={consent.consentGiven}
          audioConsent={consent.audioConsent}
        />
      )}

      {step === 2 && (
        <DocumentUpload caseId={caseId} onComplete={handleDocumentComplete} />
      )}

      {step === 3 && isAyush && (
        <AyushQuestionnaire caseId={caseId} onComplete={handleAyushComplete} />
      )}

      {step === 4 && caseId && (
        <RogiPatrika
          caseId={caseId}
          onConfirm={completeAndExit}
          onBack={handleReviewBack}
        />
      )}
    </div>
  );
}
