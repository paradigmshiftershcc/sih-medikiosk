import { useState } from "react";
import {
  ShieldCheck,
  Mic,
  User,
  Users,
  Lock,
  ArrowRight,
  ScrollText,
} from "lucide-react";
import Button from "../ui/Button";

// DPDP-aligned consent gate shown before any health data is captured.
export default function ConsentScreen({ onConsent }) {
  const [dataConsent, setDataConsent] = useState(false);
  const [audioConsent, setAudioConsent] = useState(true);
  const [informantType, setInformantType] = useState("self");
  const [relationship, setRelationship] = useState("");

  const canContinue =
    dataConsent && (informantType === "self" || relationship.trim().length > 0);

  const submit = () => {
    if (!canContinue) return;
    onConsent({
      consentGiven: true,
      audioConsent,
      informant: {
        type: informantType,
        relationship: informantType === "companion" ? relationship.trim() : "",
      },
    });
  };

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
          <p className="text-sm text-gray-500">
            Required before we begin your consultation
          </p>
        </div>
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-3 text-sm text-gray-700">
        <div className="flex items-start gap-3">
          <ScrollText className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <p>
            We collect your conversation, any documents you upload, optional
            voice recordings, and AYUSH profiling answers. This information is
            used solely to prepare a clinical summary for your treating doctor.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
          <p>
            Your data is stored securely and shared only with the doctor
            assigned to your case. You may withdraw consent and ask for your
            data to be removed at any time.
          </p>
        </div>
      </div>

      {/* Who is providing the history */}
      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-800">
          Who is providing this history?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInformantType("self")}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
              informantType === "self"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <User className="w-5 h-5 text-brand-600" />
            <div>
              <p className="font-semibold text-gray-800">Myself (patient)</p>
              <p className="text-xs text-gray-500">I am the patient</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setInformantType("companion")}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-colors ${
              informantType === "companion"
                ? "border-brand-500 bg-brand-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <Users className="w-5 h-5 text-brand-600" />
            <div>
              <p className="font-semibold text-gray-800">
                Someone else (companion)
              </p>
              <p className="text-xs text-gray-500">
                I am answering for the patient
              </p>
            </div>
          </button>
        </div>

        {informantType === "companion" && (
          <input
            type="text"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Relationship to patient (e.g., son, spouse, caregiver)"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        )}
      </div>

      {/* Consents */}
      <div className="space-y-3 border-t border-gray-50 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dataConsent}
            onChange={(e) => setDataConsent(e.target.checked)}
            className="mt-1 w-4 h-4 accent-brand-600"
          />
          <span className="text-sm text-gray-700">
            I consent to MediKiosk processing my health information to prepare a
            clinical summary for my doctor.{" "}
            <span className="text-red-500 font-medium">(Required)</span>
          </span>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={audioConsent}
            onChange={(e) => setAudioConsent(e.target.checked)}
            className="mt-1 w-4 h-4 accent-brand-600"
          />
          <span className="text-sm text-gray-700 flex items-center gap-2">
            <Mic className="w-4 h-4 text-gray-400" />
            I consent to my voice being recorded and transcribed. (Optional —
            you can always type instead)
          </span>
        </label>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={submit}
          disabled={!canContinue}
          className="flex items-center gap-2"
        >
          Continue to Consultation <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
