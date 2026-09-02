import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ChatInterface from '../components/intake/ChatInterface.jsx';
import DocumentUpload from '../components/intake/DocumentUpload.jsx';
import AyushQuestionnaire from '../components/intake/AyushQuestionnaire.jsx';

export default function IntakeFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Retrieve the AYUSH mode preference passed from the Dashboard
  const isAyush = location.state?.ayushMode || false;
  
  // Manage Wizard State: 1 = Chat, 2 = Document Upload, 3 = AYUSH (Conditional)
  const [step, setStep] = useState(1);
  const [caseId, setCaseId] = useState(null);

  /* STREAMING_CHUNK: Handling progression between intake steps */
  const handleChatComplete = (finalCaseId) => {
    if (!finalCaseId) {
      console.error("Missing caseId from chat completion!");
      return;
    }
    setCaseId(finalCaseId);
    setStep(2);
  };

  const handleDocumentComplete = () => {
    if (isAyush) {
      setStep(3);
    } else {
      // If AYUSH is not enabled, we are done. Route straight to the Doctor View.
      navigate(`/doctor/${caseId}`); 
    }
  };

  const handleAyushComplete = () => {
    // If AYUSH is enabled, this is the final step. Route to the Doctor View.
    navigate(`/doctor/${caseId}`);
  };

  /* STREAMING_CHUNK: Rendering the Intake Flow layout */
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Navigation / Progress Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
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
            {step === 3 && "Step 3: Ayurvedic Profiling"}
          </p>
        </div>
      </div>

      {/* Render Current Step */}
      {step === 1 && (
        <ChatInterface onComplete={handleChatComplete} />
      )}
      
      {step === 2 && (
        <DocumentUpload caseId={caseId} onComplete={handleDocumentComplete} />
      )}

      {step === 3 && isAyush && (
        <AyushQuestionnaire caseId={caseId} onComplete={handleAyushComplete} />
      )}
      
    </div>
  );
}
