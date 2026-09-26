import { Phone } from "lucide-react";
import { REFERRALS } from "../../lib/referrals.js";

export default function SupportReferrals({ compact = false }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-ink mb-1 flex items-center gap-2">
        <Phone className="w-4 h-4 text-brand-600" /> Official support helplines
      </h3>
      <p className="text-xs text-muted mb-3">
        External referral numbers. Sahaay never contacts anyone automatically —
        a human officer or you makes any call.
      </p>
      <div className={`grid gap-2 ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"}`}>
        {REFERRALS.map((ref) => (
          <div
            key={ref.number}
            className="flex items-center justify-between gap-3 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink truncate">{ref.name}</p>
              <p className="text-[11px] text-muted truncate">{ref.description}</p>
            </div>
            <span className="text-sm font-bold text-brand-700 shrink-0">{ref.number}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
