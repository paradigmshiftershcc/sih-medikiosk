import { useMemo } from "react";
import { Loader2, AlertCircle, HeartHandshake } from "lucide-react";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import EmptyState from "../../components/cases/EmptyState.jsx";

const PATHWAY_INFO = [
  { code: "COUNSELLING", label: "Counselling", description: "Counselling / mental-health professional review." },
  { code: "LEGAL_AID", label: "Legal Aid", description: "Legal-aid referral, e.g. via NALSA 15100." },
  { code: "MEDICAL", label: "Medical Assistance", description: "Medical check / injury care referral." },
  { code: "POLICE_REVIEW", label: "Police Review", description: "Police review / protection assessment by authorities." },
  { code: "PROTECTION_REVIEW", label: "Protection Review", description: "Victim/witness protection eligibility review." },
  { code: "SHELTER_REHABILITATION", label: "Shelter / Rehabilitation", description: "Shelter, welfare and rehabilitation support." },
  { code: "EMERGENCY_SUPPORT", label: "Emergency Support", description: "Immediate emergency + human escalation." },
  { code: "HUMAN_REVIEW", label: "Human Escalation", description: "Duty-officer review without delay." },
];

// Support Pathways: aggregated demand from existing recommendation data
// (case supportNeeds). Counts, not new backend.
export default function PathwaysPage() {
  const { queue, loading, error } = useOfficerQueue("all");

  const counts = useMemo(() => {
    const map = {};
    for (const c of queue) {
      for (const need of c.supportNeeds || []) {
        map[need] = (map[need] || 0) + 1;
      }
    }
    return map;
  }, [queue]);

  const max = Math.max(1, ...PATHWAY_INFO.map((p) => counts[p.code] || 0));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Support Pathways</h1>
        <p className="text-muted mt-1">
          Aggregated demand from recommendation data on submitted cases. Pathways are recommendations — every action stays human.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-7 h-7 animate-spin text-brand-600" />
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          title="No pathway demand yet"
          body="Pathway counts build up as cases are assessed and submitted."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {PATHWAY_INFO.map((pathway) => {
            const value = counts[pathway.code] || 0;
            return (
              <div key={pathway.code} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-ink flex items-center gap-2">
                    <HeartHandshake className="w-4 h-4 text-brand-600 shrink-0" />
                    {pathway.label}
                  </h3>
                  <p className="text-2xl font-bold text-brand-700">{value}</p>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mt-3 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all"
                    style={{ width: `${Math.round((value / max) * 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-2">{pathway.description}</p>
                <p className="text-[11px] font-mono text-gray-400 mt-1">{pathway.code}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
