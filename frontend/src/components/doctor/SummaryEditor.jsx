import { useState } from "react";
import {
  Pencil,
  Save,
  ShieldCheck,
  Loader2,
  Sparkles,
  Send,
  CheckCircle,
  Bot,
} from "lucide-react";
import api from "../../services/api";
import Button from "../ui/Button";

const TEXT_FIELDS = [
  { key: "chiefComplaint", label: "Chief Complaint", rows: 2 },
  { key: "hpi", label: "History of Present Illness", rows: 7 },
  { key: "ayushSummary", label: "AYUSH Summary", rows: 3 },
];

const LIST_FIELDS = [
  { key: "pastMedicalHistory", label: "Past Medical History" },
  { key: "medications", label: "Medications" },
  { key: "allergies", label: "Allergies" },
  { key: "redFlags", label: "Red Flags" },
  { key: "documentFindings", label: "Document Findings" },
  { key: "missingInformation", label: "Missing Information" },
  { key: "clinicianAttention", label: "Clinician Attention" },
];

const AYUSH_KEYS = [
  ["prakriti", "Prakriti"],
  ["vikriti", "Vikriti"],
  ["sara", "Sara"],
  ["samhanana", "Samhanana"],
  ["pramana", "Pramana"],
  ["satmya", "Satmya"],
  ["sattva", "Sattva"],
  ["agni", "Agni"],
  ["koshtha", "Koshtha"],
  ["abhyavaharanaShakti", "Ahara Shakti"],
  ["jaranaShakti", "Jarana Shakti"],
  ["vyayamaShakti", "Vyayama Shakti"],
  ["vaya", "Vaya"],
  ["ashtavidhaJihva", "Jihva"],
  ["ashtavidhaNidra", "Nidra"],
  ["ashtavidhaMutraMala", "Mutra-Mala"],
  ["nidanaAharaHetu", "Nidana — Ahara"],
  ["nidanaViharaHetu", "Nidana — Vihara"],
  ["nidanaManasikaHetu", "Nidana — Manasika"],
];

const SUGGESTIONS = [
  "Summarize the key abnormal investigations.",
  "What medications is this patient on?",
  "Are there any red flags I should prioritize?",
  "What information is missing from this case?",
];

export default function SummaryEditor({ caseId, summary, status, onVerified }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => structuredClone(summary || {}));
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [notice, setNotice] = useState("");
  const [verified, setVerified] = useState(status === "VERIFIED");

  const [question, setQuestion] = useState("");
  const [chat, setChat] = useState([]);
  const [asking, setAsking] = useState(false);

  const setField = (key, value) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const startEditing = () => {
    setDraft(structuredClone(summary || {}));
    setEditing(true);
    setNotice("");
  };

  const sanitize = () => {
    const clean = structuredClone(draft);
    LIST_FIELDS.forEach(({ key }) => {
      if (Array.isArray(clean[key])) {
        clean[key] = clean[key].map((v) => v.trim()).filter(Boolean);
      }
    });
    return clean;
  };

  const saveDraft = async () => {
    setSaving(true);
    setNotice("");
    try {
      const payload = sanitize();
      await api.put(`/summary/${caseId}`, { summary: payload });
      setNotice("Draft saved.");
      setEditing(false);
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to save summary.");
    } finally {
      setSaving(false);
    }
  };

  const verify = async () => {
    setVerifying(true);
    setNotice("");
    try {
      const payload = sanitize();
      await api.put(`/summary/${caseId}/verify`, { summary: payload });
      setVerified(true);
      setEditing(false);
      setNotice("Summary verified and accepted.");
      onVerified?.();
    } catch (err) {
      setNotice(err.response?.data?.message || "Failed to verify summary.");
    } finally {
      setVerifying(false);
    }
  };

  const ask = async (q) => {
    const query = (q ?? question).trim();
    if (!query) return;
    setChat((prev) => [...prev, { role: "user", text: query }]);
    setQuestion("");
    setAsking(true);
    try {
      const { data } = await api.post(`/summary/${caseId}/copilot`, { query });
      setChat((prev) => [
        ...prev,
        { role: "assistant", text: data.answer, sources: data.sources },
      ]);
    } catch (err) {
      setChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: err.response?.data?.message || "Copilot is unavailable.",
          error: true,
        },
      ]);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Verification bar */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border ${
          verified
            ? "bg-blue-50 border-blue-200"
            : "bg-white border-gray-200"
        }`}
      >
        <div className="flex items-center gap-2">
          {verified ? (
            <>
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-800">
                Verified by you — this record is signed off.
              </span>
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                Review the AI summary, edit if needed, then accept it.
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button
              variant="outline"
              onClick={startEditing}
              className="flex items-center gap-2"
            >
              <Pencil className="w-4 h-4" /> Edit Summary
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setEditing(false)}
                disabled={saving || verifying}
              >
                Cancel
              </Button>
              <Button
                onClick={saveDraft}
                disabled={saving || verifying}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save Draft
              </Button>
            </>
          )}
          <Button
            onClick={verify}
            disabled={verifying || saving}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {verifying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShieldCheck className="w-4 h-4" />
            )}
            {verified ? "Re-verify" : "Verify & Accept"}
          </Button>
        </div>
      </div>

      {notice && (
        <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-4 py-2">
          {notice}
        </p>
      )}

      {editing && (
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
          <h3 className="font-semibold text-gray-800 border-b border-gray-50 pb-2">
            Edit Summary
          </h3>

          {TEXT_FIELDS.map(({ key, label, rows }) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {label}
              </label>
              <textarea
                rows={rows}
                value={draft[key] || ""}
                onChange={(e) => setField(key, e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {LIST_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label} (one per line)
                </label>
                <textarea
                  rows={3}
                  value={(draft[key] || []).join("\n")}
                  onChange={(e) => setField(key, e.target.value.split("\n"))}
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Dashavidha Assessment
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AYUSH_KEYS.map(([key, label]) => (
                <div key={key}>
                  <label className="text-[11px] text-gray-500">{label}</label>
                  <input
                    type="text"
                    value={draft.ayushAssessment?.[key] || ""}
                    onChange={(e) =>
                      setField("ayushAssessment", {
                        ...(draft.ayushAssessment || {}),
                        [key]: e.target.value,
                      })
                    }
                    className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Copilot */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-4">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-gray-800">Case Copilot</h3>
          <span className="text-xs text-gray-400">
            answers only from this record
          </span>
        </div>

        {chat.length > 0 && (
          <div className="space-y-3 mb-4 max-h-72 overflow-y-auto">
            {chat.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-2 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <Bot className="w-4 h-4 text-brand-500 mt-1 shrink-0" />
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-brand-600 text-white"
                      : msg.error
                        ? "bg-red-50 text-red-700 border border-red-100"
                        : "bg-gray-50 text-gray-800 border border-gray-100"
                  }`}
                >
                  {msg.text}
                  {msg.role === "assistant" && msg.sources > 0 && (
                    <span className="block mt-1.5 text-[10px] text-gray-400">
                      Retrieved {msg.sources} case excerpt
                      {msg.sources > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {asking && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Copilot is
                thinking...
              </div>
            )}
          </div>
        )}

        {chat.length === 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about this case..."
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="px-3 py-2 rounded-xl bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
