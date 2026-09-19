import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { Loader2, Activity, Pill, History, ClipboardList, Leaf, AlertCircle, ArrowLeft, ShieldAlert, Download } from 'lucide-react';
// Adding explicit .jsx extensions to satisfy Vite strictness
import SummarySection from '../components/doctor/SummarySection.jsx';
import RedFlagBadge from '../components/doctor/RedFlagBadge.jsx';
import SummaryEditor from '../components/doctor/SummaryEditor.jsx';
import Button from '../components/ui/Button.jsx';

// Charts are heavy; load the Recharts-based panel only when this view renders.
const AnalyticsPanel = lazy(
  () => import('../components/analytics/AnalyticsPanel.jsx'),
);

export default function DoctorView() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

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
  }, [caseId, reload]);

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

  const { summary, patient, redFlags, ayushMode, interactionAlerts, status } = data;

  const exportFhir = async () => {
    try {
      const { data: bundle } = await api.get(
        `/fhir/case/${caseId}/OPConsultation`,
      );
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/fhir+json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OPConsultation-${caseId}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('FHIR export failed:', err);
    }
  };

  const AYUSH_ASSESSMENT_LABELS = [
    { key: 'prakriti', label: 'Prakriti (Constitution)' },
    { key: 'vikriti', label: 'Vikriti (Imbalance)' },
    { key: 'sara', label: 'Sara (Vitality)' },
    { key: 'samhanana', label: 'Samhanana (Frame)' },
    { key: 'pramana', label: 'Pramana (Proportion)' },
    { key: 'satmya', label: 'Satmya (Tolerance)' },
    { key: 'sattva', label: 'Sattva (Mind)' },
    { key: 'agni', label: 'Agni (Digestion)' },
    { key: 'koshtha', label: 'Koshtha (Bowels)' },
    { key: 'abhyavaharanaShakti', label: 'Ahara Shakti (Appetite)' },
    { key: 'jaranaShakti', label: 'Jarana Shakti (Digestion)' },
    { key: 'vyayamaShakti', label: 'Vyayama Shakti (Endurance)' },
    { key: 'vaya', label: 'Vaya (Age Stage)' },
    { key: 'ashtavidhaJihva', label: 'Jihva (Tongue)' },
    { key: 'ashtavidhaNidra', label: 'Nidra (Sleep)' },
    { key: 'ashtavidhaMutraMala', label: 'Mutra-Mala' },
    { key: 'nidanaAharaHetu', label: 'Nidana — Ahara Hetu' },
    { key: 'nidanaViharaHetu', label: 'Nidana — Vihara Hetu' },
    { key: 'nidanaManasikaHetu', label: 'Nidana — Manasika Hetu' },
  ];

  const ayushAssessment = summary?.ayushAssessment;
  const assessedFields = AYUSH_ASSESSMENT_LABELS.filter(
    ({ key }) =>
      ayushAssessment?.[key] && ayushAssessment[key] !== 'Not assessed',
  );

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
        <div className="flex items-center gap-2">
          <button
            onClick={exportFhir}
            className="flex items-center gap-2 text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-xl transition-colors font-medium text-sm"
            title="Export as FHIR R4 (OPConsultation)"
          >
            <Download className="w-4 h-4" /> Export FHIR
          </button>
          <div className="bg-brand-600 text-white px-3 py-1 rounded-full text-sm font-bold tracking-wide shadow-sm">
            CONFIDENTIAL - DOCTOR VIEW
          </div>
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

      {/* Drug Interaction Alerts */}
      {interactionAlerts?.length > 0 && (
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-800 border-b border-amber-100 pb-2 mb-3">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-semibold text-lg">
              Drug Interaction Alerts ({interactionAlerts.length})
            </h3>
          </div>
          <ul className="space-y-1.5">
            {interactionAlerts.map((alert, index) => (
              <li key={index} className="text-sm text-amber-900 flex gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

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
          
          {ayushMode && (summary?.ayushSummary || assessedFields.length > 0) && (
            <div className="bg-green-50 p-5 rounded-2xl border border-green-200 shadow-sm">
              <div className="flex items-center gap-2 text-green-800 border-b border-green-100 pb-2 mb-3">
                <Leaf className="w-5 h-5" />
                <h3 className="font-semibold text-lg">Dashavidha Pariksha (AYUSH Profiling)</h3>
              </div>

              {assessedFields.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {assessedFields.map(({ key, label }) => (
                    <div key={key} className="bg-white/70 rounded-xl px-3 py-2 border border-green-100">
                      <p className="text-[11px] uppercase tracking-wide font-semibold text-green-700">{label}</p>
                      <p className="text-sm text-green-950 font-medium">{ayushAssessment[key]}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-green-900 leading-relaxed">{summary.ayushSummary}</p>
              )}

              {summary?.ayushSummary && (
                <p className="text-green-900 leading-relaxed mt-3 text-sm border-t border-green-100 pt-3">
                  {summary.ayushSummary}
                </p>
              )}
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

      {/* Summary editing, verification & copilot */}
      <SummaryEditor
        caseId={caseId}
        summary={summary}
        status={status}
        onVerified={() => setReload((r) => r + 1)}
      />

      {/* Trends & Medical Timeline */}
      <Suspense
        fallback={
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          </div>
        }
      >
        <AnalyticsPanel scope={{ type: 'case', caseId }} />
      </Suspense>
    </div>
  );
}