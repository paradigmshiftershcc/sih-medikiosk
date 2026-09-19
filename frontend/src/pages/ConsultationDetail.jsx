import { useEffect, useState, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../services/api.js";
import Card from "../components/ui/Card.jsx";

// Charts are heavy; load the Recharts-based panel only when this view renders.
const AnalyticsPanel = lazy(
  () => import("../components/analytics/AnalyticsPanel.jsx"),
);
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Leaf,
  CheckCircle,
  ClipboardList,
  History,
  Pill,
  FileText,
} from "lucide-react";

const DASH_GRID = [
  { key: "prakriti", label: "Prakriti (Body Nature)" },
  { key: "vikriti", label: "Vikriti (Imbalance)" },
  { key: "agni", label: "Agni (Digestion)" },
  { key: "koshtha", label: "Koshtha (Bowels)" },
  { key: "sara", label: "Sara (Vitality)" },
  { key: "samhanana", label: "Samhanana (Frame)" },
  { key: "sattva", label: "Sattva (Mind)" },
  { key: "satmya", label: "Satmya (Tolerance)" },
  {
    key: "abhyavaharanaShakti",
    label: "Ahara Shakti (Appetite)",
    nested: "aharaShakti",
  },
  {
    key: "jaranaShakti",
    label: "Jarana Shakti (Digestion)",
    nested: "aharaShakti",
  },
  { key: "vyayamaShakti", label: "Vyayama Shakti (Endurance)" },
  { key: "vaya", label: "Vaya (Life Stage)" },
];

export default function ConsultationDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        // Patient-scoped review endpoint returns the full structured record
        // (summary, Dashavidha data, document findings) for this patient only.
        const { data } = await api.get(`/intake/${caseId}/review`);
        setConsultation(data);
      } catch (err) {
        console.error("Error fetching consultation:", err);
        setError(
          err.response?.data?.message ||
            "Failed to load consultation details.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchConsultation();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <button
          onClick={() => navigate("/dashboard")}
          className="mb-4 flex items-center gap-2 text-brand-600 hover:text-brand-700"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-600">
          {error || "Consultation not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <Card className="space-y-6">
        <div className="border-b pb-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Consultation Status
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {new Date(consultation.createdAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-brand-50 p-4 rounded-xl border border-brand-200">
            <p className="text-xs text-brand-600 font-semibold uppercase tracking-wider mb-1">
              Chief Complaint
            </p>
            <p className="text-gray-900 font-semibold">
              {consultation.summary?.chiefComplaint || "Pending Summary"}
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider mb-1">
              Status
            </p>
            <div className="flex items-center gap-2">
              {consultation.status === "ASSIGNED" ? (
                <>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-gray-900 font-semibold">
                    Waiting in Queue
                  </span>
                </>
              ) : consultation.status === "VERIFIED" ? (
                <>
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-gray-900 font-semibold">
                    Verified by Doctor
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-gray-900 font-semibold">Completed</span>
                </>
              )}
            </div>
          </div>

          {consultation.priority && (
            <div
              className={`p-4 rounded-xl border ${consultation.priority === "URGENT_REVIEW" ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-wider mb-1 ${consultation.priority === "URGENT_REVIEW" ? "text-red-600" : "text-gray-600"}`}
              >
                Priority
              </p>
              <div className="flex items-center gap-2">
                {consultation.priority === "URGENT_REVIEW" && (
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                )}
                <span className="text-gray-900 font-semibold capitalize">
                  {consultation.priority.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>
            </div>
          )}

          {consultation.ayushMode && (
            <div className="bg-green-50 p-4 rounded-xl border border-green-200">
              <p className="text-xs text-green-600 font-semibold uppercase tracking-wider mb-1">
                AYUSH Mode
              </p>
              <div className="flex items-center gap-2">
                <Leaf className="w-4 h-4 text-green-600" />
                <span className="text-gray-900 font-semibold">
                  Ayurvedic Consultation
                </span>
              </div>
            </div>
          )}
        </div>

        {consultation.redFlags && consultation.redFlags.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl">
            <p className="text-sm font-semibold text-yellow-900 mb-2">
              Clinical Concerns Noted
            </p>
            <div className="space-y-1">
              {consultation.redFlags.map((flag, idx) => (
                <p
                  key={idx}
                  className="text-sm text-yellow-800 flex items-center gap-2"
                >
                  <span className="text-yellow-500">•</span> {flag}
                </p>
              ))}
            </div>
          </div>
        )}

        {consultation.summary?.hpi && (
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 mb-2 text-gray-700">
              <ClipboardList className="w-4 h-4" />
              <p className="text-sm font-semibold">
                Illness Details (HPI)
              </p>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {consultation.summary.hpi}
            </p>
          </div>
        )}

        {(consultation.summary?.pastMedicalHistory?.length > 0 ||
          consultation.summary?.medications?.length > 0 ||
          consultation.summary?.allergies?.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Past Medical History",
                icon: History,
                items: consultation.summary?.pastMedicalHistory,
              },
              {
                title: "Medications",
                icon: Pill,
                items: consultation.summary?.medications,
              },
              {
                title: "Allergies",
                icon: AlertTriangle,
                items: consultation.summary?.allergies,
              },
            ].map(({ title, icon: Icon, items }) =>
              items && items.length > 0 ? (
                <div
                  key={title}
                  className="bg-white p-4 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-2 mb-2 text-gray-700">
                    <Icon className="w-4 h-4" />
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {title}
                    </p>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 text-sm text-gray-800">
                    {items.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null,
            )}
          </div>
        )}

        {consultation.ayushMode && consultation.ayushData && (
          <div>
            <div className="flex items-center gap-2 mb-3 text-green-800">
              <Leaf className="w-4 h-4" />
              <p className="text-sm font-semibold">
                Dashavidha Pariksha (Ayurvedic Assessment)
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DASH_GRID.map(({ key, label, nested }) => {
                const value = nested
                  ? consultation.ayushData?.[nested]?.[key]
                  : consultation.ayushData?.[key];
                if (!value) return null;
                return (
                  <div
                    key={key}
                    className="bg-emerald-50 p-3 rounded-xl border border-emerald-100"
                  >
                    <p className="text-[11px] text-gray-500">{label}</p>
                    <p className="text-sm font-semibold text-emerald-900">
                      {value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {consultation.summary?.documentFindings?.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-700">
              <FileText className="w-4 h-4" />
              <p className="text-sm font-semibold">From Your Documents</p>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
              {consultation.summary.documentFindings.map((finding, idx) => (
                <li key={idx}>{finding}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Your clinical summary has been prepared for the doctor.
          </p>
          <p className="text-sm text-gray-600">
            This case has been assigned to the appropriate specialty. Your
            doctor will review your consultation details and medical information
            before your appointment.
          </p>
        </div>
      </Card>

      <Suspense
        fallback={
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
          </div>
        }
      >
        <AnalyticsPanel scope={{ type: "patient" }} patientView />
      </Suspense>
    </div>
  );
}
