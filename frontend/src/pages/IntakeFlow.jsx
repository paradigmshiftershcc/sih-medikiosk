import ChatInterface from '../components/intake/ChatInterface';
import DocumentUpload from '../components/intake/DocumentUpload';
import AyushQuestionnaire from '../components/intake/AyushQuestionnaire';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';

export default function IntakeFlow() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAyush = location.state?.ayushMode || false;
  
  // Manage Wizard State: 1 = Chat, 2 = Document Upload, 3 = AYUSH (Conditional)
  const [step, setStep] = useState(1);
  const [caseId, setCaseId] = useState(null);

  const handleChatComplete = (finalCaseId) => {
    setCaseId(finalCaseId);
    setStep(2);
  };

  const handleDocumentComplete = () => {
    if (isAyush) {
      setStep(3);
    } else {
      navigate('/dashboard'); // We will route to Final Summary here in Phase 6
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Top Navigation / Progress Indicator */}
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate('/dashboard')}
          className="p-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
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

      {step === 1 && (
        <ChatInterface onComplete={handleChatComplete} />
      )}
      
      {step === 2 && (
        <DocumentUpload caseId={caseId} onComplete={handleDocumentComplete} />
      )}

      {step === 3 && isAyush && (
        <AyushQuestionnaire caseId={caseId} onComplete={() => navigate('/dashboard')} />
      )}
      
    </div>
  );
}