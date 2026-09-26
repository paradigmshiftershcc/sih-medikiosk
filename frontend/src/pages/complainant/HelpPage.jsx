import SupportReferrals from "../../components/support/SupportReferrals.jsx";

const FAQS = [
  {
    q: "What is Sahaay?",
    a: "Sahaay is an AI-assisted triage prototype for the National Helpline Against Atrocities (NHAA). It helps you share what happened and prepares an urgency assessment with quoted evidence for a human support officer to review. It is not a diagnostic or legal-decision system.",
  },
  {
    q: "Is my voice recording stored?",
    a: "No. Your voice is transcribed to text for you to review before sending, and the raw recording is never stored.",
  },
  {
    q: "Who sees my case?",
    a: "Only you, and authorized support officers in the NHAA Support Command Center who review it to connect you with help.",
  },
  {
    q: "What if I am in danger right now?",
    a: "If you are in immediate danger, contact emergency services directly at 112, or the NHAA helpline at 14566. Sahaay itself never contacts anyone automatically.",
  },
  {
    q: "Can I stop or withdraw?",
    a: "Yes. You can stop sharing at any time, and exiting records nothing further.",
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Help &amp; Emergency</h1>
        <p className="text-muted mt-1">Answers and urgent contact numbers.</p>
      </div>

      <div className="bg-risk-critical/5 border border-risk-critical/30 rounded-2xl p-5">
        <h2 className="font-bold text-risk-critical">In immediate danger?</h2>
        <p className="text-sm text-gray-700 mt-1">
          Call <strong>112</strong> (Emergency) or <strong>14566</strong> (NHAA)
          right away. Do not wait for an online assessment.
        </p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        {FAQS.map((item) => (
          <div key={item.q} className="border-b border-gray-50 last:border-0 pb-3 last:pb-0">
            <p className="text-sm font-semibold text-ink">{item.q}</p>
            <p className="text-sm text-muted mt-1">{item.a}</p>
          </div>
        ))}
      </div>

      <SupportReferrals />
    </div>
  );
}
