import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import api from "../services/api.js";
import Card from "../components/ui/Card.jsx";
import {
  ArrowLeft,
  AlertTriangle,
  Loader2,
  Leaf,
  CheckCircle,
} from "lucide-react";

export default function ConsultationDetail() {
  const { caseId } = useParams();
  const navigate = useNavigate();

  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchConsultation = async () => {
      try {
        // First fetch the case record
        const { data } = await api.get(`/intake/history`);
        const caseRecord = data.find((c) => c._id === caseId);
        if (!caseRecord) {
          setError("Consultation not found.");
          return;
        }
        setConsultation(caseRecord);
      } catch (err) {
        console.error("Error fetching consultation:", err);
        setError("Failed to load consultation details.");
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
              {consultation.finalSummary?.chiefComplaint || "Pending Summary"}
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
    </div>
  );
}
