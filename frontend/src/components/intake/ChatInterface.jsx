import { useState, useEffect, useRef } from 'react';
import { Mic, Send, AlertTriangle, Loader2, CheckCircle2, Globe } from 'lucide-react';
import { useSpeech } from '../../hooks/useSpeech';
import api from '../../services/api';

const OPENING =
  "I'm here to help you share what happened and identify what support may be needed. You can type or speak in your preferred language. You are in control of what you choose to share.";

const LANGUAGES = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'mr', label: 'मराठी' },
  { value: 'gu', label: 'ગુજરાતી' },
  { value: 'bn', label: 'বাংলা' },
];

const PHASE_LABELS = {
  transcribing: 'TRANSCRIBING',
  analyzing: 'ANALYZING',
  updating: 'UPDATING ASSESSMENT',
  ready: 'READY',
};

export default function ChatInterface({ caseId, language = 'auto', onLanguageChange, onComplete, voiceAllowed = true }) {
  const [messages, setMessages] = useState([{ role: 'model', content: OPENING }]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryComplete, setIsHistoryComplete] = useState(false);
  const [urgentFlag, setUrgentFlag] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [phase, setPhase] = useState('ready');
  const [liveSvi, setLiveSvi] = useState(null);
  const [aiDegraded, setAiDegraded] = useState(false);

  const chatEndRef = useRef(null);
  // Pending voice payload for the NEXT send only: derived features travel
  // with the message; raw audio travels only to enable the optional
  // in-memory affect analysis and is never persisted server-side.
  const pendingVoiceRef = useRef(null);

  const { isListening, voiceStatus, voiceError, setVoiceStatus, setVoiceError, clearVoiceError, toggleRecording } = useSpeech({
    onAudioReady: (base64, mimeType, voiceFeatures) => {
      // Transcribe only: text goes into the input for the complainant to
      // review. Nothing is submitted until Send is pressed. No audio stored.
      pendingVoiceRef.current = voiceFeatures ? { base64, mimeType, voiceFeatures } : null;
      transcribeVoiceInput(base64, mimeType);
    },
    onError: () => {},
  });

  const transcribeVoiceInput = async (audioBase64, mimeType) => {
    setVoiceStatus('transcribing');
    setPhase('transcribing');
    clearVoiceError();
    try {
      const { data } = await api.post(`/cases/${caseId}/transcribe`, {
        audioBase64,
        mimeType,
        language,
      }, { timeout: 45000 });
      if (data?.text) {
        setInputText(data.text);
      } else {
        throw new Error('EMPTY_TRANSCRIPTION');
      }
    } catch (error) {
      pendingVoiceRef.current = null;
      setVoiceError(
        error.response?.data?.message ||
        'Voice transcription is temporarily unavailable. Please type your answer instead.'
      );
    } finally {
      setVoiceStatus('idle');
      setPhase('ready');
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (textOverride = null) => {
    const textToSend = (textOverride || inputText).trim();
    if (!textToSend || !caseId) return;

    // Attach the pending voice payload (if this turn was spoken), then
    // clear it so typed turns never carry stale audio.
    const voicePayload = pendingVoiceRef.current;
    pendingVoiceRef.current = null;

    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
    setInputText('');
    setIsLoading(true);
    setPhase('analyzing');

    try {
      const body = { message: textToSend, language };
      if (voicePayload?.voiceFeatures) {
        body.voiceAnalytics = voicePayload.voiceFeatures;
        // In-memory affect analysis only; the server never persists audio.
        body.audioBase64 = voicePayload.base64;
        body.mimeType = voicePayload.mimeType;
      }
      const { data } = await api.post(`/cases/${caseId}/chat`, body, { timeout: 40000 });

      setPhase('updating');
      setMessages(prev => [...prev, { role: 'model', content: data.response }]);
      if (data.isComplete) setIsHistoryComplete(true);
      if (data.urgentFlag || data.immediateDangerMentioned) setUrgentFlag(true);
      if (data.svi) setLiveSvi(data.svi);
      if (data.aiAvailable === false) setAiDegraded(true);
      // Brief UPDATING beat so the assessment step is visible, then READY.
      setTimeout(() => setPhase('ready'), 900);
    } catch (error) {
      let errorMsg = "I'm sorry, I encountered a network error. Could you repeat that?";
      if (error.code === 'ECONNABORTED') {
        errorMsg = 'The service is temporarily busy. Please try again in a moment.';
      }
      setMessages(prev => [...prev, { role: 'model', content: errorMsg }]);
      setPhase('ready');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[66vh] bg-white rounded-2xl shadow-sm border border-brand-100 overflow-hidden relative">
      {/* Header */}
      <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-brand-700">Your Support Session</h3>
          {phase !== 'ready' && (
            <span className="text-[11px] font-bold tracking-wide text-brand-600 bg-white border border-brand-200 rounded-full px-2.5 py-0.5">
              {PHASE_LABELS[phase]}
            </span>
          )}
          {phase === 'ready' && liveSvi && (
            <span className="text-[11px] font-bold tracking-wide text-ink bg-white border border-gray-200 rounded-full px-2.5 py-0.5">
              SVI {liveSvi.score} · {liveSvi.riskLevel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 relative">
          {showLanguage ? (
            <select
              value={language}
              onChange={(e) => { onLanguageChange?.(e.target.value); setShowLanguage(false); }}
              className="bg-white border border-brand-200 rounded-lg text-sm font-medium text-brand-800 focus:outline-none px-2 py-1 shadow-sm"
              autoFocus
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
          ) : (
            <button
              onClick={() => setShowLanguage(true)}
              className="p-2 rounded-full bg-white text-brand-700 border border-brand-200 shadow-sm"
              title="Change language"
            >
              <Globe className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Urgent safety banner */}
      {urgentFlag && (
        <div className="bg-risk-critical/10 px-4 py-3 flex items-start gap-2 border-b border-risk-critical/30">
          <AlertTriangle className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
          <p className="text-sm text-risk-critical font-semibold">
            Your immediate safety may be at risk. This case requires urgent
            human review.
          </p>
        </div>
      )}

      {voiceError && (
        <div className="bg-orange-50 px-4 py-2 flex items-center gap-2 border-b border-orange-100">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <p className="text-sm text-orange-700 font-medium">{voiceError}</p>
        </div>
      )}

      {aiDegraded && (
        <div className="bg-amber-50 px-4 py-2 flex items-center gap-2 border-b border-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <p className="text-sm text-amber-800 font-medium">
            AI analysis unavailable — deterministic safety analysis active.
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 sm:px-5 shadow-sm ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-none'
                : 'bg-gray-100 text-ink rounded-tl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-muted rounded-2xl rounded-tl-none px-5 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> {phase === 'updating' ? 'Updating assessment...' : phase === 'analyzing' ? 'Analyzing...' : 'Thinking...'}
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 sm:p-4 bg-white border-t border-brand-100 flex flex-col gap-3">
        <div className="flex items-center gap-2 sm:gap-3 max-w-3xl mx-auto w-full">
          {voiceAllowed && (
            <button
              onClick={toggleRecording}
              disabled={isLoading || voiceStatus === 'transcribing'}
              className={`p-3 sm:p-4 rounded-full flex-shrink-0 transition-all ${
                isListening
                  ? 'bg-red-100 text-red-600 animate-pulse shadow-inner'
                  : 'bg-brand-100 text-brand-600 hover:bg-brand-200 shadow-sm'
              }`}
              title={isListening ? 'Stop recording' : 'Speak in your language'}
            >
              <Mic className="w-6 h-6 sm:w-7 sm:h-7" />
            </button>
          )}

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder={
              isListening
                ? 'Recording... tap mic to stop'
                : voiceStatus === 'transcribing'
                  ? 'Transcribing...'
                  : 'Type or speak — everything stays in your control'
            }
            disabled={isListening || voiceStatus === 'transcribing'}
            className="flex-1 min-w-0 py-3 px-3 sm:px-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50 text-base sm:text-lg"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="p-3 sm:p-4 bg-brand-600 text-white rounded-full flex-shrink-0 disabled:opacity-50 hover:bg-brand-700 transition-colors shadow-sm"
            title="Send"
          >
            <Send className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Completion Action */}
        {(messages.length > 3 || isHistoryComplete || urgentFlag) && (
          <div className="flex justify-center mt-2">
            <button
              onClick={() => onComplete(caseId)}
              className="flex items-center gap-2 px-6 py-2 bg-green-100 text-green-700 font-medium rounded-xl hover:bg-green-200 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finish &amp; Review What I Shared
            </button>
          </div>
        )}
      </div>
    </div>
  );
}