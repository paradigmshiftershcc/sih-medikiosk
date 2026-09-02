import ChatInterface from '../components/intake/ChatInterface';
import DocumentUpload from '../components/intake/DocumentUpload';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function IntakeFlow() {
  const navigate = useNavigate();
  
  // Manage Wizard State: 1 = Chat, 2 = Document Upload, 3 = AYUSH (Next Phase)
  const [step, setStep] = useState(1);
  const [caseId, setCaseId] = useState(null);

  const handleChatComplete = (finalCaseId) => {
    setCaseId(finalCaseId);
    setStep(2);
  };

  const handleDocumentComplete = () => {
    // We will route to Phase 5 (AYUSH / Summary) here later.
    navigate('/dashboard');
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
          </p>
        </div>
      </div>

      {step === 1 && (
        <ChatInterface onComplete={handleChatComplete} />
      )}
      
      {step === 2 && (
        <DocumentUpload caseId={caseId} onComplete={handleDocumentComplete} />
      )}
      
    </div>
  );
}