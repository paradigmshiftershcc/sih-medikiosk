import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Globe, ArrowRight, LogOut, Mic, Lock } from "lucide-react";
import Button from "../ui/Button";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "hi", label: "हिंदी (Hindi)" },
  { value: "mr", label: "मराठी (Marathi)" },
  { value: "gu", label: "ગુજરાતી (Gujarati)" },
  { value: "bn", label: "বাংলা (Bengali)" },
];

// Sahaay consent gate (SIH26093). Consent is captured before any sensitive
// content is recorded. No recordings, no sensitive questions, no case is
// created before this screen. Five plain-language purposes are shown
// separately; voice processing is individually acknowledged.
const CONSENT_ITEMS = [
  {
    key: "intakeProcessing",
    title: "Complaint & intake processing",
    body: "What you share is used to understand your situation, assess urgency, and connect you with appropriate support.",
  },
  {
    key: "voiceTranscription",
    title: "Voice recording & transcription",
    body: "Your voice may be processed by the configured speech/AI service to create a transcript and supporting speech indicators. Sahaay does not store the raw recording.",
  },
  {
    key: "aiAnalysis",
    title: "AI-assisted analysis",
    body: "An AI assistant helps read what you shared and pulls out key points with quotes. A fixed, explainable scoring method — not the AI — computes the urgency score, and a human officer reviews everything.",
  },
  {
    key: "storage",
    title: "Retention & storage",
    body: "Your transcript and assessment are stored with your case so a support officer can review them. Raw voice recordings are never stored (retention: 0).",
  },
];

export default function ConsentScreen({ onConsent }) {
  const navigate = useNavigate();
  const [language, setLanguage] = useState("auto");
  const [voiceAllowed, setVoiceAllowed] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-brand-100 shadow-sm p-6 sm:p-8 space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
        <div className="p-2.5 bg-brand-50 rounded-xl">
          <ShieldCheck className="w-6 h-6 text-brand-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Your Privacy &amp; Consent
          </h2>
          <p className="text-sm text-muted">
            Required before you begin sharing
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {CONSENT_ITEMS.map((item) => (
          <div
            key={item.key}
            className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex items-start gap-3"
          >
            {item.key === "voiceTranscription" ? (
              <Mic className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            )}
            <div>
              <p className="text-sm font-semibold text-gray-800">{item.title}</p>
              <p className="text-sm text-gray-600 mt-0.5">{item.body}</p>
            </div>
          </div>
        ))}
        <div className="bg-brand-50/50 rounded-xl p-4 border border-brand-100 flex items-start gap-3">
          <input
            id="voice-allowed"
            type="checkbox"
            checked={voiceAllowed}
            onChange={(e) => setVoiceAllowed(e.target.checked)}
            className="mt-1 w-4 h-4 accent-brand-600"
          />
          <label htmlFor="voice-allowed" className="text-sm text-gray-700">
            <span className="font-semibold">Allow voice input.</span> If
            unticked, you can still type — the microphone stays hidden and no
            voice is processed.
          </label>
        </div>
        <p className="text-sm text-gray-600">
          You may stop at any time. Withdrawing means simply exiting — nothing
          further is recorded or analysed.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <Globe className="w-4 h-4 text-brand-600" /> Preferred language
        </label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Button
          onClick={() =>
            onConsent({
              consentGiven: true,
              language,
              scopes: {
                intakeProcessing: true,
                voiceTranscription: voiceAllowed,
                aiAnalysis: true,
                storage: true,
              },
              voiceNoticeAcknowledged: true,
            })
          }
          className="flex items-center gap-2 flex-1 justify-center"
        >
          I Consent &amp; Continue <ArrowRight className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-2 flex-1 justify-center"
        >
          <LogOut className="w-4 h-4" /> Exit
        </Button>
      </div>
      <p className="text-xs text-gray-400 text-center">
        You are never asked to prove anything or to repeat anything that hurts.
      </p>
    </div>
  );
}