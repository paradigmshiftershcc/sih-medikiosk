import { useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import EmptyState from "../../components/cases/EmptyState.jsx";

const RISK_COLORS = {
  CRITICAL: "#DC2626",
  HIGH: "#EA580C",
  MODERATE: "#D97706",
  LOW: "#16A34A",
};

// Assessment Trends: cases over time, risk mix, average SVI — all derived
// from existing case data. Clearly labelled prototype analytics.
export default function TrendsPage() {
  const { queue, loading, error } = useOfficerQueue("all");

  const trends = useMemo(() => {
    const byDay = {};
    const riskMix = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0 };
    let sviSum = 0;
    let sviCount = 0;
    const pathwayDemand = {};
    for (const c of queue) {
      const day = c.submittedAt
        ? new Date(c.submittedAt).toISOString().slice(0, 10)
        : "unsent";
      byDay[day] = (byDay[day] || 0) + 1;
      const risk = c.svi?.riskLevel;
      if (riskMix[risk] !== undefined) riskMix[risk] += 1;
      if (typeof c.svi?.score === "number") {
        sviSum += c.svi.score;
        sviCount += 1;
      }
      for (const need of c.supportNeeds || []) {
        pathwayDemand[need] = (pathwayDemand[need] || 0) + 1;
      }
    }
    return {
      overTime: Object.entries(byDay)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, cases]) => ({ date, cases })),
      riskMix: Object.entries(riskMix).map(([name, value]) => ({ name, value })),
      avgSvi: sviCount ? Math.round((sviSum / sviCount) * 10) / 10 : null,
      criticalHigh:
        (riskMix.CRITICAL || 0) + (riskMix.HIGH || 0),
      pathwayDemand: Object.entries(pathwayDemand)
        .map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5),
    };
  }, [queue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Assessment Trends</h1>
        <p className="text-muted mt-1">
          Prototype / demo analytics — derived from submitted case data, not a validated instrument.
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
          title="No trend data yet"
          body="Trends build up as cases are submitted over time."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total cases", value: queue.length },
              { label: "Critical + High", value: trends.criticalHigh },
              { label: "Average SVI", value: trends.avgSvi ?? "—" },
              { label: "Days active", value: trends.overTime.length },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm text-center">
                <p className="text-3xl font-bold text-ink">{s.value}</p>
                <p className="text-xs text-muted font-semibold uppercase tracking-wide mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-ink mb-2">Cases over time</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trends.overTime} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="cases" stroke="#0D9488" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-ink mb-2">Risk distribution</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.riskMix} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {trends.riskMix.map((entry) => (
                        <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#0D9488"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm md:col-span-2">
              <h3 className="text-sm font-semibold text-ink mb-2">Top support pathway demand</h3>
              <div className="space-y-2">
                {trends.pathwayDemand.length === 0 && (
                  <p className="text-sm text-muted">No pathway data yet.</p>
                )}
                {trends.pathwayDemand.map((p) => (
                  <div key={p.name} className="flex items-center gap-3 text-sm">
                    <span className="w-48 shrink-0 text-gray-700 truncate">{p.name}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${Math.round((p.value / Math.max(1, queue.length)) * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 text-right font-bold text-ink">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
