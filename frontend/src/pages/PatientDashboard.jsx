import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import api from "../services/api";
import {
  AlertCircle,
  ChevronRight,
  Clock,
  FileText,
  Leaf,
  Loader2,
} from "lucide-react";

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ayushMode, setAyushMode] = useState(true);
  const [pastCases, setPastCases] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await api.get("/intake/history");
        setPastCases(response.data);
      } catch (error) {
        console.error("Failed to fetch history:", error);
        setHistoryError("Could not load past consultations.");
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-brand-700">
            Welcome, {user?.name}
          </h1>
          <p className="text-gray-600 mt-1">
            Manage your health records and start new consultations.
          </p>
        </div>
        <button
          onClick={logout}
          className="text-sm text-red-600 hover:underline font-medium"
        >
          Logout
        </button>
      </div>

      <Card className="border-l-4 border-l-brand-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">
              ABDM / ABHA Identity
            </h3>
            <p className="text-gray-500 text-sm">
              Your health records are securely linked.
            </p>
          </div>
          <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-lg font-mono font-medium border border-brand-100">
            {user?.abhaId || "Pending Generation"}
          </div>
        </div>
      </Card>

      <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">
        New Consultation
      </h2>

      {/* AYUSH Toggle */}
      <div className="mb-6 flex items-center justify-between bg-green-50 border border-green-200 p-4 rounded-2xl transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg text-green-700">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">AYUSH Consultation</h3>
            <p className="text-green-700 text-sm hidden sm:block">
              Enable Ayurvedic profiling (Dashavidha Pariksha)
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={ayushMode}
            onChange={(e) => setAyushMode(e.target.checked)}
          />
          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      <button
        onClick={() => navigate("/intake", { state: { ayushMode } })}
        className="w-full text-left flex flex-col justify-between bg-brand-600 text-white p-6 rounded-2xl shadow-sm hover:bg-brand-700 transition-colors group"
      >
        <div className="bg-white/20 w-fit p-3 rounded-xl">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div className="flex items-center justify-between mt-4">
          <div>
            <h3 className="text-lg font-bold">Start Case Taking</h3>
            <p className="text-brand-100 text-sm">
              Create a summary for the doctor
            </p>
          </div>
          <ChevronRight className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </button>

      <section className="mt-10" aria-labelledby="past-consultations-heading">
        <h2
          id="past-consultations-heading"
          className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2"
        >
          <Clock className="w-5 h-5 text-gray-500" /> Past Consultations
        </h2>

        {isLoadingHistory ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
          </div>
        ) : historyError ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {historyError}
          </div>
        ) : pastCases.length === 0 ? (
          <div className="bg-white border border-gray-100 p-8 rounded-2xl text-center text-gray-500">
            No past consultations found.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {pastCases.map((record) => (
              <button
                key={record._id}
                onClick={() => navigate(`/consultation/${record._id}`)}
                className="w-full text-left bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-brand-300 hover:shadow-md transition-all flex justify-between items-center group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-500">
                    {new Date(record.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <h3 className="font-semibold text-gray-800 mt-1 truncate">
                    {record.finalSummary?.chiefComplaint ||
                      "Consultation Record"}
                  </h3>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${record.status === "ASSIGNED" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-700 border-gray-200"}`}
                    >
                      {record.status === "ASSIGNED"
                        ? "Waiting in Queue"
                        : "Completed"}
                    </span>
                    {record.ayushMode && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                        <Leaf className="w-3 h-3" /> AYUSH
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600 group-hover:translate-x-1 transition-transform shrink-0 ml-4" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
