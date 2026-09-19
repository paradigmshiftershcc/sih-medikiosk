import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  LineChart as LineChartIcon,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import api from "../../services/api";

const RANGES = [
  { label: "30 days", days: 30 },
  { label: "3 months", days: 90 },
  { label: "6 months", days: 180 },
  { label: "1 year", days: 365 },
];

const baseFor = (scope) =>
  scope.type === "case" ? `/analytics/case/${scope.caseId}` : "/analytics/me";

function TrendChart({ data }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-56 text-sm text-gray-400">
        No values recorded in this period.
      </div>
    );
  }

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6b7280" }} />
          <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} width={48} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload;
              return (
                <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm">
                  <p className="font-bold">{point.date}</p>
                  <p>
                    {point.value} {point.unit}
                    {point.isAbnormal && (
                      <span className="ml-2 text-red-400 font-bold">
                        Abnormal
                      </span>
                    )}
                  </p>
                  {point.referenceRange && (
                    <p className="text-gray-300 text-xs mt-1">
                      Ref: {point.referenceRange}
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload, index } = props;
              return (
                <circle
                  key={`dot-${index}`}
                  cx={cx}
                  cy={cy}
                  r={payload.isAbnormal ? 5 : 3.5}
                  fill={payload.isAbnormal ? "#dc2626" : "#2563eb"}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              );
            }}
            activeDot={{ r: 6, fill: "#1d4ed8" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AnalyticsPanel({ scope, patientView = false }) {
  const base = baseFor(scope);

  const [metrics, setMetrics] = useState([]);
  const [metric, setMetric] = useState("");
  const [days, setDays] = useState(180);
  const [trend, setTrend] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoadingMetrics(true);
      try {
        const [metricsRes, timelineRes] = await Promise.all([
          api.get(`${base}/metrics`),
          api.get(`${base}/timeline`),
        ]);
        if (cancelled) return;
        setMetrics(metricsRes.data);
        setTimeline(timelineRes.data);
        if (metricsRes.data.length > 0) setMetric(metricsRes.data[0].metricCode);
      } catch (err) {
        console.error("Analytics load error:", err);
      } finally {
        if (!cancelled) setLoadingMetrics(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [base]);

  useEffect(() => {
    if (!metric) return;
    let cancelled = false;
    const load = async () => {
      setLoadingTrend(true);
      try {
        const { data } = await api.get(`${base}/trends`, {
          params: { metric, days },
        });
        if (!cancelled) setTrend(data);
      } catch (err) {
        console.error("Trend load error:", err);
      } finally {
        if (!cancelled) setLoadingTrend(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [base, metric, days]);

  if (loadingMetrics) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  const selectedMetric = metrics.find((m) => m.metricCode === metric);

  return (
    <div className="space-y-6">
      {/* Trends */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-4">
          <LineChartIcon className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-gray-800">
            {patientView ? "Your Test Trends" : "Investigation Trends"}
          </h3>
        </div>

        {metrics.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No lab values have been extracted from your documents yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <select
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                className="flex-1 min-w-[200px] border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {metrics.map((m) => (
                  <option key={m.metricCode} value={m.metricCode}>
                    {m.metricName} ({m.count})
                    {m.anyAbnormal ? " ⚠" : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-1 bg-gray-50 border border-gray-200 rounded-xl p-1">
                {RANGES.map((r) => (
                  <button
                    key={r.days}
                    onClick={() => setDays(r.days)}
                    className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                      days === r.days
                        ? "bg-brand-600 text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {selectedMetric?.unit && (
              <p className="text-xs text-gray-400 mb-1">
                Unit: {selectedMetric.unit}
              </p>
            )}

            {loadingTrend ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
              </div>
            ) : (
              <TrendChart data={trend} />
            )}
          </>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-50 pb-3 mb-4">
          <Clock className="w-5 h-5 text-brand-600" />
          <h3 className="font-semibold text-gray-800">Medical Timeline</h3>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No documents or consultations on record yet.
          </p>
        ) : (
          <ol className="relative border-l border-gray-200 ml-2 space-y-5">
            {timeline.map((item) => (
              <li key={item.caseId} className="ml-4">
                <span
                  className={`absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full border-2 border-white ${
                    item.priority === "URGENT_REVIEW"
                      ? "bg-red-500"
                      : item.abnormalCount > 0
                        ? "bg-amber-500"
                        : "bg-brand-500"
                  }`}
                />
                <p className="text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <p className="text-sm font-semibold text-gray-800">
                  {item.documentType || "Consultation"}
                  {item.ayushMode && (
                    <span className="ml-2 text-[11px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full border border-green-200">
                      AYUSH
                    </span>
                  )}
                </p>
                {item.chiefComplaint && (
                  <p className="text-sm text-gray-600">{item.chiefComplaint}</p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs">
                  {item.labCount > 0 && (
                    <span className="text-gray-500">
                      {item.labCount} lab value{item.labCount > 1 ? "s" : ""}
                    </span>
                  )}
                  {item.abnormalCount > 0 && (
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      <AlertTriangle className="w-3 h-3" />
                      {item.abnormalCount} abnormal
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
