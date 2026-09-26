import { useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import EmptyState from "../../components/cases/EmptyState.jsx";
import { CHANNEL_LABELS, INCIDENT_LABELS } from "../../lib/caseMeta.js";

const RISK_COLORS = {
  CRITICAL: "#DC2626",
  HIGH: "#EA580C",
  MODERATE: "#D97706",
  LOW: "#16A34A",
  UNKNOWN: "#94a3b8",
};

const ChartCard = ({ title, hint, children }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
    <h3 className="text-sm font-semibold text-ink">{title}</h3>
    {hint && <p className="text-xs text-muted mt-0.5 mb-2">{hint}</p>}
    <div className="h-56 mt-2">{children}</div>
  </div>
);

export default function OfficerAnalytics() {
  const { queue, loading, error } = useOfficerQueue("all");

  const data = useMemo(() => {
    const byRisk = {};
    const byChannel = {};
    const byIncident = {};
    const byStatus = {};
    for (const c of queue) {
      const risk = c.svi?.riskLevel || "UNKNOWN";
      byRisk[risk] = (byRisk[risk] || 0) + 1;
      const ch = CHANNEL_LABELS[c.sourceChannel] || "Web portal";
      byChannel[ch] = (byChannel[ch] || 0) + 1;
      const it = INCIDENT_LABELS[c.incidentType] || "Unknown";
      byIncident[it] = (byIncident[it] || 0) + 1;
      byStatus[c.status || "UNKNOWN"] = (byStatus[c.status || "UNKNOWN"] || 0) + 1;
    }
    const toArr = (obj) => Object.entries(obj).map(([name, value]) => ({ name, value }));
    return {
      byRisk: toArr(byRisk),
      byChannel: toArr(byChannel),
      byIncident: toArr(byIncident),
      byStatus: toArr(byStatus),
    };
  }, [queue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">Analytics</h1>
        <p className="text-muted mt-1">
          Prototype / demo analytics — computed live from submitted case data. No separate analytics backend.
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
          title="No data to chart yet"
          body="Analytics appear once cases are submitted. Demo seed data (SEED_DEMO=true) provides a representative sample."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Cases by Risk">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byRisk} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {data.byRisk.map((entry) => (
                    <Cell key={entry.name} fill={RISK_COLORS[entry.name] || "#0D9488"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Case Status">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byStatus} dataKey="value" nameKey="name" outerRadius={75} label={{ fontSize: 11 }}>
                  {data.byStatus.map((entry, i) => (
                    <Cell key={entry.name} fill={["#0D9488", "#3b82f6", "#EA580C", "#16A34A", "#64748b", "#DC2626"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Cases by Channel">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byChannel} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0D9488" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Cases by Incident Type">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byIncident} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  );
}
