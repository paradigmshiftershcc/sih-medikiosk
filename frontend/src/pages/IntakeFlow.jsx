import ChatInterface from '../components/intake/ChatInterface';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function IntakeFlow() {
  const navigate = useNavigate();

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
          <p className="text-sm text-gray-500">Step 1: Clinical History</p>
        </div>
      </div>

      {/* Phase 3: The Conversational Engine */}
      <ChatInterface />

      {/* In Phase 4, we will add the Next/Finish buttons and Document Upload below */}
      
    </div>
  );
}