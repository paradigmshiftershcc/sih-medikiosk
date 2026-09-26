import { useMemo } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";
import { useOfficerQueue } from "../../hooks/useOfficerQueue.js";
import OfficerCaseTable from "../../components/cases/OfficerCaseTable.jsx";
import EmptyState from "../../components/cases/EmptyState.jsx";

const PRESETS = {
  all: {
    scope: "all",
    title: "All Cases",
    subtitle: "Every submitted case, including resolved and closed.",
    filter: () => true,
    emptyTitle: "No cases found",
    emptyBody: "No submitted cases exist yet.",
  },
  critical: {
    scope: undefined,
    title: "Critical Cases",
    subtitle: "Cases in the CRITICAL band — review first.",
    filter: (c) => c.svi?.riskLevel === "CRITICAL",
    emptyTitle: "No critical cases",
    emptyBody: "There are currently no cases in the CRITICAL band.",
  },
  assigned: {
    scope: "all",
    title: "Assigned to Me",
    subtitle: "Cases currently assigned to you.",
    filter: (c, user) => c.assignedOfficer?._id === user?._id,
    emptyTitle: "Nothing assigned to you",
    emptyBody: "Cases you assign to yourself will appear here.",
  },
  review: {
    scope: undefined,
    title: "Needs Review",
    subtitle: "New or in-review cases waiting for an officer.",
    filter: (c) => ["NEW", "IN_REVIEW"].includes(c.status) && !c.assignedOfficer,
    emptyTitle: "Nothing waiting for review",
    emptyBody: "Every active case already has an officer looking at it.",
  },
  escalated: {
    scope: "all",
    title: "Escalated",
    subtitle: "Cases escalated for senior or urgent handling.",
    filter: (c) => c.status === "ESCALATED",
    emptyTitle: "No escalated cases",
    emptyBody: "Cases officers escalate will appear here.",
  },
  resolved: {
    scope: "all",
    title: "Resolved Cases",
    subtitle: "Support provided or closed — the completed record.",
    filter: (c) => ["RESOLVED", "CLOSED"].includes(c.status),
    emptyTitle: "No resolved cases yet",
    emptyBody: "Your resolved cases will appear here.",
  },
};

export default function OfficerCases({ preset = "all" }) {
  const { user } = useAuth();
  const config = PRESETS[preset] || PRESETS.all;
  const { queue, loading, error } = useOfficerQueue(config.scope);

  const cases = useMemo(
    () => queue.filter((c) => config.filter(c, user)),
    [queue, config, user],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink">{config.title}</h1>
        <p className="text-muted mt-1">{config.subtitle}</p>
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
      ) : cases.length === 0 ? (
        <EmptyState title={config.emptyTitle} body={config.emptyBody} />
      ) : (
        <OfficerCaseTable cases={cases} emptyTitle={config.emptyTitle} emptyBody={config.emptyBody} />
      )}
    </div>
  );
}
