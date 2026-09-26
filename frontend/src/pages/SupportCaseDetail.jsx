import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api.js";
import RiskBadge from "../components/ui/RiskBadge.jsx";
import SupportReferrals from "../components/support/SupportReferrals.jsx";
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  HeartHandshake,
  CheckCircle2,
  FileText,
  UserCheck,
  AudioLines,
  History,
  Settings2,
} from "lucide-react";

const STATUS_LABELS = {
  NEW: "Submitted to Support",
  IN_REVIEW: "Being Reviewed",
  ESCALATED: "Escalated",
  ASSIGNED: "Officer Assigned",
  RESOLVED: "Support Provided",
  CLOSED: "Closed",
};

const CHANNEL_LABELS = {
  VOICE_CALL: "Voice call",
  WEB_PORTAL: "Web portal",
  CHATBOT: "Chatbot",
  MOBILE_APP: "Mobile app",
  IVRS: "IVRS",
  OTHER: "Other",
};

const INCIDENT_LABELS = {
  CASTE_DISCRIMINATION: "Caste discrimination",
  PHYSICAL_VIOLENCE: "Physical violence",
  SEXUAL_VIOLENCE: "Sexual violence",
  THREAT_INTIMIDATION: "Threat / intimidation",
  SOCIAL_BOYCOTT: "Social boycott",
  DISPLACEMENT: "Displacement",
  FAMILY_DEATH: "Family death",
  LEGAL_PROCEEDING_DISTRESS: "Legal-proceeding distress",
  OTHER: "Other",
  UNKNOWN: "Unknown",
};

const SAFETY_LABELS = { SAFE: "Safe", UNSAFE: "Unsafe", UNKNOWN: "Unknown" };

const SUPPORT_NEEDS = [
  "COUNSELLING",
  "LEGAL_AID",
  "MEDICAL",
  "POLICE_REVIEW",
  "PROTECTION_REVIEW",
  "SHELTER_REHABILITATION",
  "EMERGENCY_SUPPORT",
  "HUMAN_REVIEW",
];

const Card = ({ children, className = "" }) => (
  <div className={`bg-white p-5 rounded-2xl border border-gray-100 shadow-sm ${className}`}>
    {children}
  </div>
);

const SectionTitle = ({ icon: Icon, children }) => (
  <h3 className="text-sm font-semibold text-ink mb-3 flex items-center gap-2">
    {Icon && <Icon className="w-4 h-4 text-brand-600" />}
    {children}
  </h3>
);

export default function SupportCaseDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [actionMsg, setActionMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [meta, setMeta] = useState(null);
  const [metaMsg, setMetaMsg] = useState("");
  const [metaBusy, setMetaBusy] = useState(false);

  // Seed the metadata editor from fetched data exactly once (promise
  // callbacks, never a synchronous effect body).
  const metaInitRef = useRef(false);

  const applyFetched = (fetched) => {
    setData(fetched);
    if (!metaInitRef.current) {
      metaInitRef.current = true;
      setMeta({
        docketNumber: fetched.externalReference?.docketNumber || "",
        incidentType: fetched.incidentType || "UNKNOWN",
        immediateSafety: fetched.immediateSafety || "UNKNOWN",
        supportNeeds: fetched.supportNeeds || [],
        sourceChannel: fetched.sourceChannel || "WEB_PORTAL",
        note: "",
      });
    }
  };

  const refresh = async () => {
    try {
      const { data } = await api.get(`/cases/${caseId}`);
      applyFetched(data);
    } catch (err) {
      console.error("Error fetching case:", err);
      setError(err.response?.data?.message || "Failed to load the case.");
    }
  };

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/cases/${caseId}`)
      .then(({ data }) => {
        if (!cancelled) applyFetched(data);
      })
      .catch((err) => {
        console.error("Error fetching case:", err);
        if (!cancelled)
          setError(err.response?.data?.message || "Failed to load the case.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const runAction = async (action) => {
    setBusy(action);
    setActionMsg("");
    try {
      if (action === "assign") {
        await api.patch(`/cases/${caseId}/assignment`, { note: actionNote });
      } else {
        await api.patch(`/cases/${caseId}/status`, {
          status: action.toUpperCase(),
          note: actionNote,
        });
      }
      setActionNote("");
      await refresh();
    } catch (err) {
      setActionMsg(err.response?.data?.message || "Action failed.");
    } finally {
      setBusy("");
    }
  };

  const saveMeta = async () => {
    setMetaBusy(true);
    setMetaMsg("");
    try {
      await api.patch(`/cases/${caseId}/meta`, meta);
      setMeta((m) => ({ ...m, note: "" }));
      await refresh();
    } catch (err) {
      setMetaMsg(err.response?.data?.message || "Metadata update failed.");
    } finally {
      setMetaBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-12 h-12 text-brand-600 animate-spin" />
        <h2 className="text-xl font-bold text-brand-800">Loading Support Case...</h2>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-50 text-red-600 p-6 rounded-2xl text-center space-y-4">
        <AlertTriangle className="w-12 h-12 mx-auto" />
        <p className="font-semibold text-lg">{error}</p>
      </div>
    );
  }

  const svi = data.assessment?.svi;
  const recs = [...(data.assessment?.recommendations || [])].sort(
    (a, b) => (a.priority ?? 9) - (b.priority ?? 9),
  );
  const transcript = data.transcript || [];
  const events = data.events || [];
  const history = data.assessmentHistory || [];
  const voice = data.voiceAnalytics;
  const docket = data.externalReference?.docketNumber;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* 1. Identity / docket header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate("/command")}
          className="flex items-center gap-2 text-brand-700 hover:bg-brand-50 px-3 py-2 rounded-xl transition-colors font-medium text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Command Center
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 font-mono">
            {docket ? `Docket ${docket}` : `Case #${String(data._id).slice(-6).toUpperCase()}`}
            {docket?.startsWith("DEMO-") ? " · DEMO DATA" : ""}
          </span>
          <div className="bg-brand-600 text-white px-3 py-1 rounded-full text-xs font-bold tracking-wide shadow-sm">
            CONFIDENTIAL — OFFICER VIEW
          </div>
        </div>
      </div>

      {/* 2. Risk banner */}
      {data.urgentFlag && (
        <div className="bg-risk-critical/10 px-4 py-3 flex items-start gap-2 border border-risk-critical/40 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-risk-critical shrink-0 mt-0.5" />
          <p className="text-sm text-risk-critical font-bold">
            IMMEDIATE DANGER / SELF-HARM INDICATED — escalate to human review without delay.
          </p>
        </div>
      )}

      {/* Identity header */}
      <div className="bg-white p-6 rounded-2xl border-l-8 border-brand-500 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{data.complainant?.name || "Complainant"}</h1>
          <p className="text-muted font-medium text-sm">
            {data.complainant?.phone || "No phone on record"} · {CHANNEL_LABELS[data.sourceChannel] || data.sourceChannel || "Web portal"} · submitted{" "}
            {data.submittedAt ? new Date(data.submittedAt).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <RiskBadge level={svi?.riskLevel} size="lg" />
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
            {STATUS_LABELS[data.status] || data.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* 3. SVI score */}
          {svi?.score !== undefined && svi?.score !== null && (
            <Card>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted font-semibold uppercase tracking-wider">
                    Stress &amp; Vulnerability Index (SVI)
                  </p>
                  <p className="text-4xl font-bold text-ink mt-1">
                    {svi.score}
                    <span className="text-sm font-medium text-muted"> / 100</span>
                  </p>
                  <p className="text-xs font-bold text-ink mt-1">{svi.band || svi.riskLevel}</p>
                </div>
                <RiskBadge level={svi?.riskLevel} />
              </div>
              {svi?.forcedCritical && (
                <p className="text-xs text-risk-high mt-2 font-medium">
                  Escalated to CRITICAL by rule (self-harm or immediate danger).
                </p>
              )}
              {svi?.engineVersion && (
                <p className="text-[11px] text-muted mt-2 font-mono">Engine: {svi.engineVersion}</p>
              )}
              {svi?.disclaimer && <p className="text-[11px] text-muted mt-1">{svi.disclaimer}</p>}
            </Card>
          )}

          {/* 4. Score breakdown */}
          <Card>
            <SectionTitle>Score breakdown (deterministic)</SectionTitle>
            {svi?.factors?.length ? (
              <div className="space-y-2">
                {svi.factors.map((factor, index) => (
                  <div key={index} className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <div className="bg-brand-100 text-brand-700 font-bold text-xs rounded-full min-w-6 h-6 px-1 flex items-center justify-center shrink-0 mt-0.5">
                      +{factor.points ?? factor.weight}
                    </div>
                    <div className="text-sm min-w-0">
                      <p className="font-medium text-ink">
                        {factor.label}
                        <span className="ml-2 text-[10px] font-mono text-muted">
                          {factor.factor || factor.signal} · {factor.source || "SELF_REPORT"}
                        </span>
                      </p>
                      {factor.evidence && <p className="text-xs text-muted mt-0.5">“{factor.evidence}”</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No vulnerability signals detected.</p>
            )}
          </Card>

          {/* 5-7. Safety, incident type, indicators */}
          <Card>
            <SectionTitle icon={ShieldCheck}>Immediate safety &amp; incident</SectionTitle>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted">Immediate safety</dt>
              <dd className={`font-bold ${data.immediateSafety === "UNSAFE" ? "text-risk-critical" : "text-ink"}`}>
                {SAFETY_LABELS[data.immediateSafety] || "Unknown"}
              </dd>
              <dt className="text-muted">Incident type</dt>
              <dd className="text-ink font-medium">{INCIDENT_LABELS[data.incidentType] || "Unknown"}</dd>
            </dl>
            {data.supportNeeds?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.supportNeeds.map((need) => (
                  <span key={need} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {need}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle>Safety &amp; vulnerability indicators</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {data.safetyIndicators?.length ? (
                data.safetyIndicators.map((indicator) => (
                  <span key={indicator} className="text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
                    {indicator}
                  </span>
                ))
              ) : (
                <p className="text-sm text-muted">None detected.</p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {data.incident?.narrative && (
            <Card>
              <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-1">Incident summary</p>
              <p className="text-sm text-ink leading-relaxed">{data.incident.narrative}</p>
              {data.incident?.category && (
                <span className="inline-block mt-2 text-[11px] font-medium uppercase text-muted px-2 py-0.5 rounded-full bg-gray-100">
                  {data.incident.category}
                </span>
              )}
            </Card>
          )}

          {/* 8. Voice analytics */}
          <Card>
            <SectionTitle icon={AudioLines}>Voice analytics</SectionTitle>
            {voice?.features ? (
              <div className="space-y-3">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-muted">Speech activity</dt>
                  <dd className="text-ink font-semibold">{Math.round((voice.features.speechRatio ?? 0) * 100)}%</dd>
                  <dt className="text-muted">Pause pattern</dt>
                  <dd className="text-ink font-semibold">{voice.features.pauseCount ?? 0} pauses (avg {voice.features.meanPauseMs ?? 0} ms)</dd>
                  <dt className="text-muted">Long pauses</dt>
                  <dd className="text-ink font-semibold">{voice.features.longPauseCount ?? 0}</dd>
                  <dt className="text-muted">Pitch variation</dt>
                  <dd className="text-ink font-semibold">
                    {voice.features.pitchMeanHz
                      ? `${Math.round(((voice.features.pitchStdHz ?? 0) / voice.features.pitchMeanHz) * 100)}% (mean ${voice.features.pitchMeanHz} Hz)`
                      : "not measurable"}
                  </dd>
                  <dt className="text-muted">Energy variation</dt>
                  <dd className="text-ink font-semibold">
                    {voice.features.rmsMean > 0
                      ? `${Math.round(((voice.features.rmsVariation ?? 0) / voice.features.rmsMean) * 100)}%`
                      : "not measurable"}
                  </dd>
                </dl>
                {voice.observations?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">Deterministic voice observations</p>
                    {voice.observations.map((obs, i) => (
                      <p key={i} className="text-xs text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold">{obs.type}</span> · {obs.severity} · {obs.evidence}
                      </p>
                    ))}
                  </div>
                )}
                {voice.affectObservations?.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide">AI voice observations (observable characteristics)</p>
                    {voice.affectObservations.map((obs, i) => (
                      <p key={i} className="text-xs text-gray-700 bg-brand-50/50 border border-brand-100 rounded-lg px-2.5 py-1.5">
                        <span className="font-semibold">{obs.label}</span> · {obs.evidence}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted border-t border-gray-100 pt-2">
                  {voice.disclaimer || "Supporting voice/speech indicators for human review — not a clinical diagnosis and never used alone to set risk."}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">No voice input for this case (typed intake).</p>
            )}
          </Card>

          {/* 12. Recommended pathways */}
          <Card>
            <SectionTitle icon={HeartHandshake}>Recommended support pathways</SectionTitle>
            {recs.length ? (
              <div className="space-y-2">
                {recs.map((rec, index) => (
                  <div key={index} className="bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                    <p className="text-sm font-medium text-ink">
                      {rec.pathway}
                      {rec.code && <span className="ml-2 text-[10px] font-mono text-muted">{rec.code}</span>}
                      {rec.priority && (
                        <span className="ml-2 text-[10px] font-bold text-brand-700">P{rec.priority}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted mt-0.5">{rec.reason || rec.rationale}</p>
                    {rec.triggerEvidence?.length > 0 && (
                      <p className="text-[11px] text-gray-600 mt-1">
                        Triggered by: “{rec.triggerEvidence[0]}”
                        {rec.triggerEvidence.length > 1 ? ` (+${rec.triggerEvidence.length - 1} more)` : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">None generated.</p>
            )}
            <p className="text-[11px] text-muted mt-3">
              AI-assisted triage. Final decisions remain with authorized human personnel. Nothing is escalated automatically.
            </p>
          </Card>

          <SupportReferrals compact />
        </div>
      </div>

      {/* 11. Evidence snippets */}
      <Card>
        <SectionTitle icon={FileText}>Evidence snippets (provenance)</SectionTitle>
        {data.evidence?.length ? (
          <ul className="space-y-1.5 text-sm">
            {data.evidence.map((item, i) => (
              <li key={i} className="flex gap-2 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                <span className="text-brand-700 font-mono text-xs shrink-0 mt-0.5">{item.signal}</span>
                <span className="text-gray-700 text-xs">“{item.evidence}”</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No quoted evidence recorded.</p>
        )}
      </Card>

      {/* Assessment Replay */}
      <Card>
        <SectionTitle icon={History}>Assessment replay (Turn → SVI)</SectionTitle>
        {history.length ? (
          <div className="space-y-1.5">
            {history.map((snap, i) => {
              const prev = i > 0 ? history[i - 1].score : null;
              const delta = prev === null ? null : snap.score - prev;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
                  <span className="font-semibold text-ink">Turn {snap.turn}</span>
                  <span className="text-muted">→</span>
                  <span className="font-bold text-ink">SVI {snap.score}</span>
                  <RiskBadge level={snap.riskLevel} />
                  {delta !== null && delta !== 0 && (
                    <span className={`text-xs font-bold ${delta > 0 ? "text-risk-high" : "text-risk-low"}`}>
                      ({delta > 0 ? "+" : ""}{delta})
                    </span>
                  )}
                  {snap.newSignals?.length > 0 && (
                    <span className="text-xs text-muted">new: {snap.newSignals.join(", ")}</span>
                  )}
                  {snap.voiceAvailable && <span className="text-xs text-brand-700">· voice indicators</span>}
                  <span className="text-[11px] text-gray-400 ml-auto">
                    {snap.at ? new Date(snap.at).toLocaleTimeString() : ""}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No per-turn snapshots recorded.</p>
        )}
      </Card>

      {/* 13-16. Consent, language, assignment, status */}
      <Card>
        <SectionTitle icon={ShieldCheck}>Case metadata</SectionTitle>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Language</dt>
          <dd className="text-ink font-medium uppercase">{data.language || "—"}</dd>
          <dt className="text-muted">Channel</dt>
          <dd className="text-ink font-medium">{CHANNEL_LABELS[data.sourceChannel] || "—"}</dd>
          <dt className="text-muted">NHAA docket</dt>
          <dd className="text-ink font-medium font-mono">{docket || "—"}</dd>
          <dt className="text-muted">Consent</dt>
          <dd className="text-ink font-medium">
            {data.consent?.granted ? "Granted" : "Not granted"}
            {data.consent?.timestamp ? ` · ${new Date(data.consent.timestamp).toLocaleDateString()}` : ""}
          </dd>
          <dt className="text-muted">Consent scopes</dt>
          <dd className="text-ink text-xs">
            {data.consent?.scopes
              ? Object.entries(data.consent.scopes).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"
              : "—"}
          </dd>
          <dt className="text-muted">Assigned officer</dt>
          <dd className="text-ink font-medium">{data.assignedOfficer?.name || "Unassigned"}</dd>
          <dt className="text-muted">Status</dt>
          <dd className="text-ink font-medium">{data.status}</dd>
        </dl>
      </Card>

      {/* Metadata editor */}
      <Card>
        <SectionTitle icon={Settings2}>Edit NHAA metadata (officer)</SectionTitle>
        {meta && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted uppercase">Docket number</span>
              <input
                value={meta.docketNumber}
                onChange={(e) => setMeta({ ...meta, docketNumber: e.target.value })}
                placeholder="e.g. NHAA-2026-00123"
                className="border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted uppercase">Channel</span>
              <select value={meta.sourceChannel} onChange={(e) => setMeta({ ...meta, sourceChannel: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2 bg-white">
                {Object.keys(CHANNEL_LABELS).map((c) => (
                  <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted uppercase">Incident type</span>
              <select value={meta.incidentType} onChange={(e) => setMeta({ ...meta, incidentType: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2 bg-white">
                {Object.keys(INCIDENT_LABELS).map((t) => (
                  <option key={t} value={t}>{INCIDENT_LABELS[t]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted uppercase">Immediate safety</span>
              <select value={meta.immediateSafety} onChange={(e) => setMeta({ ...meta, immediateSafety: e.target.value })} className="border border-gray-200 rounded-xl px-3 py-2 bg-white">
                {Object.keys(SAFETY_LABELS).map((s) => (
                  <option key={s} value={s}>{SAFETY_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <span className="text-xs font-semibold text-muted uppercase">Support needs</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {SUPPORT_NEEDS.map((need) => (
                  <label key={need} className="flex items-center gap-1.5 text-xs border border-gray-200 rounded-full px-2.5 py-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={meta.supportNeeds.includes(need)}
                      onChange={(e) =>
                        setMeta({
                          ...meta,
                          supportNeeds: e.target.checked
                            ? [...meta.supportNeeds, need]
                            : meta.supportNeeds.filter((n) => n !== need),
                        })
                      }
                      className="w-3.5 h-3.5 accent-brand-600"
                    />
                    {need}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-semibold text-muted uppercase">Note (timeline)</span>
              <input
                value={meta.note}
                onChange={(e) => setMeta({ ...meta, note: e.target.value })}
                placeholder="Optional note for this change"
                className="border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </label>
          </div>
        )}
        {metaMsg && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mt-3">{metaMsg}</div>}
        <button
          onClick={saveMeta}
          disabled={metaBusy}
          className="mt-3 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
        >
          {metaBusy ? "Saving..." : "Save metadata"}
        </button>
        <p className="text-[11px] text-muted mt-2">Metadata never affects the SVI score.</p>
      </Card>

      {/* Officer actions */}
      <Card>
        <SectionTitle icon={UserCheck}>Officer actions</SectionTitle>
        <textarea
          value={actionNote}
          onChange={(e) => setActionNote(e.target.value)}
          placeholder="Optional note for this action (visible on the case timeline)"
          rows={2}
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white mb-3"
        />
        {actionMsg && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm mb-3">{actionMsg}</div>}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => runAction("assign")} disabled={busy !== ""} className="px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50">
            {busy === "assign" ? "Assigning..." : "Assign to Me"} (→ ASSIGNED)
          </button>
          <button onClick={() => runAction("in_review")} disabled={busy !== ""} className="px-4 py-2 bg-blue-50 text-blue-700 rounded-xl text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-50">
            Start Review (→ IN_REVIEW)
          </button>
          <button onClick={() => runAction("escalated")} disabled={busy !== ""} className="px-4 py-2 bg-risk-high/10 text-risk-high rounded-xl text-sm font-medium hover:bg-risk-high/20 transition-colors disabled:opacity-50">
            Escalate
          </button>
          <button onClick={() => runAction("resolved")} disabled={busy !== ""} className="px-4 py-2 bg-risk-low/10 text-risk-low rounded-xl text-sm font-medium hover:bg-risk-low/20 transition-colors disabled:opacity-50">
            Mark Resolved
          </button>
          <button onClick={() => runAction("closed")} disabled={busy !== ""} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-300 transition-colors disabled:opacity-50">
            Close
          </button>
        </div>
      </Card>

      {/* 10. Transcript */}
      <Card>
        <SectionTitle icon={FileText}>Conversation transcript</SectionTitle>
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {transcript.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "bg-brand-100 text-brand-900" : "bg-gray-100 text-ink"}`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 17. Timeline */}
      <Card>
        <SectionTitle icon={CheckCircle2}>Review timeline</SectionTitle>
        {events.length ? (
          <div className="space-y-2">
            {events.map((event, index) => (
              <div key={index} className="flex items-start gap-3 text-sm">
                <div className="bg-brand-100 w-2 h-2 rounded-full mt-1.5 shrink-0" />
                <p className="text-gray-700">
                  <span className="font-semibold text-ink">{event.status}</span>{" "}
                  by <span className="font-medium">{event.officerName || "System"}</span>
                  {event.note ? <span className="text-muted"> — {event.note}</span> : null}
                  <span className="text-muted block text-xs">{event.at ? new Date(event.at).toLocaleString() : ""}</span>
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No review activity yet.</p>
        )}
      </Card>
    </div>
  );
}
