import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import RiskBadge from "../ui/RiskBadge.jsx";
import { STATUS_LABELS, fmtDate, shortId } from "../../lib/caseMeta.js";

export default function ComplainantCaseCard({ record }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/cases/${record._id}`)}
      className="w-full text-left bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-brand-300 hover:shadow-md transition-all flex justify-between items-center group"
    >
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted">
          <span className="font-mono">#{shortId(record._id)}</span> · {fmtDate(record.createdAt)}
          {record.updatedAt && record.updatedAt !== record.createdAt
            ? ` · updated ${fmtDate(record.updatedAt)}`
            : ""}
        </p>
        <h3 className="font-semibold text-ink mt-1 truncate">
          {record.incident?.narrative || "Support request"}
        </h3>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <RiskBadge level={record.assessment?.svi?.riskLevel} />
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            {STATUS_LABELS[record.status] || record.status}
          </span>
          {record.urgentFlag && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-risk-critical/10 text-risk-critical border border-risk-critical/30">
              Needs urgent review
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-transform shrink-0 ml-4" />
    </button>
  );
}
