import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { Loader2, Activity, Pill, History, ClipboardList, Leaf, AlertCircle, ArrowLeft } from 'lucide-react';
// Adding explicit .jsx extensions to satisfy Vite strictness
import SummarySection from '../components/doctor/SummarySection.jsx';
import RedFlagBadge from '../components/doctor/RedFlagBadge.jsx';
import Button from '../components/ui/Button.jsx';

export default function DoctorView() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      console.log(`[DoctorView] Fetching summary for caseId: ${caseId}`);
      try {
        const response = await api.get(`/summary/${caseId}`);
        setData(response.data);
      } catch (err) {
        console.error("Error fetching summary:", err);
        setError("Failed to generate or load the case summary.");
      } finally {
        setLoading(false);
      }
    };

    if (caseId) {
      fetchSummary();
    }
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
        <h2 className="text-xl font-bold text-brand-800">Synthesizing Patient Case...</h2>
        <p className="text-gray-500">Gemini is compiling chat, documents, and AYUSH data.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center space-y-4">
        <AlertCircle className="w-12 h-12 mx-auto" />
        <p className="font-semibold text-lg">{error}</p>
        <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
      </div>
    );
  }

  const { summary, patient, redFlags, ayushMode } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12 animate-in fade-in duration-500">
      
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <button 
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-brand-700 hover:bg-brand-50 px-3 py-2 rounded-xl transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Exit Doctor View
        </button>
        <div className="bg-brand-600 text-white px-3 py-1 rounded-full text-sm font-bold tracking-wide shadow-sm">
          CONFIDENTIAL - DOCTOR VIEW
        </div>
      </div>

      {/* Patient Header Card */}
      <div className="bg-white p-6 rounded-2xl border-l-8 border-brand-500 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{patient?.name || 'Unknown Patient'}</h1>
          <p className="text-gray-500 font-medium">ABDM / ABHA: {patient?.abhaId || 'Pending'}</p>
        </div>
        <div className="bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 text-right">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Date</p>
          <p className="text-gray-800 font-medium">{new Date().toLocaleDateString()}</p>
        </div>
      </div>

      {/* Red Flags Alert */}
      <RedFlagBadge flags={redFlags} />

      {/* Main Clinical Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Column (Primary HPI) */}
        <div className="md:col-span-2 space-y-6">
          <SummarySection 
            title="Chief Complaint" 
            content={summary?.chiefComplaint} 
            icon={Activity} 
          />
          <SummarySection 
            title="History of Present Illness (HPI)" 
            content={summary?.hpi} 
            icon={ClipboardList} 
          />
          
          {ayushMode && summary?.ayushSummary && (
            <div className="bg-green-50 p-5 rounded-2xl border border-green-200 shadow-sm">
              <div className="flex items-center gap-2 text-green-800 border-b border-green-100 pb-2 mb-3">
                <Leaf className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Dashavidha Pariksha (AYUSH Profiling)</h3>
              </div>
              <p className="text-green-900 leading-relaxed">{summary.ayushSummary}</p>
            </div>
          )}
        </div>

        {/* Right Column (History & Meds) */}
        <div className="space-y-6">
          <SummarySection 
            title="Past Medical History" 
            content={summary?.pastMedicalHistory} 
            icon={History} 
          />
          <SummarySection 
            title="Medications" 
            content={summary?.medications} 
            icon={Pill} 
          />
          <SummarySection 
            title="Allergies" 
            content={summary?.allergies} 
            icon={AlertCircle} 
          />
        </div>
      </div>
    </div>
  );
}