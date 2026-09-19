import { useEffect, useState } from 'react';
import {
  Leaf,
  Loader2,
  AlertTriangle,
  Volume2,
  VolumeX,
  CheckCircle2,
  Pencil,
} from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import api from '../../services/api';

const DASH_VIDHA_LABELS = [
  { key: 'prakriti', label: 'Prakriti (Body Nature)', hindi: 'प्रकृति' },
  { key: 'vikriti', label: 'Vikriti (Imbalance)', hindi: 'विकृति' },
  { key: 'agni', label: 'Agni (Digestion)', hindi: 'अग्नि' },
  { key: 'koshtha', label: 'Koshtha (Bowel Nature)', hindi: 'कोष्ठ' },
  { key: 'sara', label: 'Sara (Vitality)', hindi: 'सार' },
  { key: 'samhanana', label: 'Samhanana (Body Frame)', hindi: 'संहनन' },
  { key: 'sattva', label: 'Sattva (Mental Strength)', hindi: 'सत्त्व' },
  { key: 'satmya', label: 'Satmya (Tolerance)', hindi: 'सात्म्य' },
  {
    key: 'abhyavaharanaShakti',
    label: 'Ahara Shakti — Appetite',
    hindi: 'अहार शक्ति',
    nested: 'aharaShakti',
  },
  {
    key: 'jaranaShakti',
    label: 'Ahara Shakti — Digestion',
    hindi: 'जरण शक्ति',
    nested: 'aharaShakti',
  },
  { key: 'vyayamaShakti', label: 'Vyayama Shakti (Endurance)', hindi: 'व्यायाम शक्ति' },
  { key: 'vaya', label: 'Vaya (Life Stage)', hindi: 'वय' },
];

const readAloud = (text, lang) => {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
};

export default function RogiPatrika({ caseId, onConfirm, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lang, setLang] = useState('hi');
  const [isReading, setIsReading] = useState(false);

  useEffect(() => {
    const fetchReview = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/intake/${caseId}/review`);
        setData(data);
      } catch (err) {
        console.error('Failed to load review:', err);
        setError(err.response?.data?.message || 'Could not load your review.');
      } finally {
        setLoading(false);
      }
    };
    fetchReview();
  }, [caseId]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const handleListen = () => {
    if (!data?.summary) return;
    setIsReading(true);
    const text = [
      data.summary.chiefComplaint,
      data.summary.hpi,
      data.summary.ayushSummary,
    ]
      .filter(Boolean)
      .join('. ');
    readAloud(text, lang);
    window.speechSynthesis.onend = () => setIsReading(false);
  };

  const handleStop = () => {
    window.speechSynthesis?.cancel();
    setIsReading(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      await onConfirm();
    } catch (err) {
      console.error('Submission failed:', err);
      setError('Could not submit your case. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-gray-500">Preparing your health summary…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <p className="text-red-600 text-center py-8">{error}</p>
        <div className="flex justify-center">
          <Button variant="outline" onClick={onBack}>
            Go Back
          </Button>
        </div>
      </Card>
    );
  }

  const { summary, ayushData, redFlags, ayushMode } = data;

  const gridPairs = DASH_VIDHA_LABELS.map(({ key, hindi, nested }) => {
    const value = nested ? ayushData?.[nested]?.[key] : ayushData?.[key];
    return { key, hindi, value };
  });

  const nidanaBits = [
    ayushData?.nidana?.aharaHetu,
    ayushData?.nidana?.viharaHetu,
    ayushData?.nidana?.manasikaHetu,
  ].filter(Boolean);

  return (
    <Card className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-emerald-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold font-serif text-emerald-900">
            रोगी स्वास्थ्य विवरण
          </h1>
          <p className="text-sm text-emerald-700">
            Please verify your health summary before it is sent to the doctor.
          </p>
        </div>
        <span className="bg-emerald-600 text-white text-xs px-3 py-1 rounded-full font-semibold">
          ABDM Verified
        </span>
      </div>

      {redFlags && redFlags.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 text-sm">
              Priority symptoms logged
            </p>
            <p className="text-amber-800 text-sm">{redFlags.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Primary complaint */}
      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
        <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">
          आपकी मुख्य समस्या / Chief Complaint
        </p>
        <p className="text-base font-medium text-gray-900">
          {summary?.chiefComplaint || 'Not recorded'}
        </p>
      </div>

      {/* HPI */}
      <div className="bg-white p-4 rounded-xl border border-gray-100">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
          Illness Details (HPI)
        </p>
        <p className="text-gray-800 leading-relaxed text-sm whitespace-pre-wrap">
          {summary?.hpi || 'Not recorded'}
        </p>
      </div>

      {/* Dashavidha grid */}
      {ayushMode && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Leaf className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-emerald-900">
              आपकी प्रकृति और शारीरिक स्थिति / Ayurvedic Assessment
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gridPairs.map((pair) => (
              <div
                key={pair.key}
                className="bg-emerald-50 p-3 rounded-xl border border-emerald-100"
              >
                <span className="block text-xs text-gray-500">{pair.hindi}</span>
                <span className="text-sm font-semibold text-emerald-900">
                  {pair.value || 'Not assessed'}
                </span>
              </div>
            ))}
          </div>

          {nidanaBits.length > 0 && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
              <p className="text-xs font-bold text-amber-900 uppercase mb-1">
                पहचाने गए संभावित कारण / Identified Lifestyle Triggers (Nidana)
              </p>
              <p className="text-sm text-amber-800">{nidanaBits.join(' • ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Document findings */}
      {summary?.documentFindings && summary.documentFindings.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            From Your Documents
          </p>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
            {summary.documentFindings.map((finding, idx) => (
              <li key={idx}>{finding}</li>
            ))}
          </ul>
        </div>
      )}

      {summary?.missingInformation && summary.missingInformation.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
            To be asked by the doctor
          </p>
          <p className="text-sm text-gray-700">
            {summary.missingInformation.join(', ')}
          </p>
        </div>
      )}

      {/* Audio confirmation */}
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
        <button
          onClick={isReading ? handleStop : handleListen}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors"
        >
          {isReading ? (
            <>
              <VolumeX className="w-4 h-4" /> Stop
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" /> सुनें / Listen
            </>
          )}
        </button>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="bg-white border border-emerald-200 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none"
        >
          <option value="hi">हिंदी</option>
          <option value="en">English</option>
        </select>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Actions */}
      <div className="flex gap-3 border-t border-gray-100 pt-5">
        <Button
          variant="outline"
          className="w-1/3"
          onClick={onBack}
          disabled={isSubmitting}
        >
          <Pencil className="w-4 h-4 mr-2" /> Edit / Back
        </Button>
        <Button
          className="w-2/3 bg-emerald-700 hover:bg-emerald-800 disabled:bg-emerald-300"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Submitting...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 mr-2" /> सही है — प्रस्तुत करें (Confirm & Submit)
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}