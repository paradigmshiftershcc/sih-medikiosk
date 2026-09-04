import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../services/api.js";
import { Users, AlertTriangle, ChevronRight, Loader2 } from "lucide-react";

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const { data } = await api.get("/doctor/queue");
        setQueue(data);
      } catch (err) {
        console.error("Queue fetch error", err);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-gray-500 font-medium">
            HPR ID: {user.hpId} • {user.specialty}
          </p>
        </div>
        <button
          onClick={logout}
          className="text-red-600 text-sm font-medium hover:underline"
        >
          Logout
        </button>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-brand-600" /> Today's OPD Queue
        </h2>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 text-gray-500 p-8 rounded-2xl text-center">
            No patients currently in your queue.
          </div>
        ) : (
          <div className="space-y-4">
            {queue.map((caseRecord) => (
              <div
                key={caseRecord._id}
                onClick={() => navigate(`/doctor/case/${caseRecord._id}`)}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:border-brand-300 cursor-pointer flex items-center justify-between group transition-all"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-bold text-gray-900">
                      {caseRecord.patientId.name}
                    </h3>
                    {caseRecord.priority === "URGENT_REVIEW" && (
                      <span className="flex items-center gap-1 text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" /> URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {caseRecord.finalSummary?.chiefComplaint || "Case Summary"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(caseRecord.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-brand-600" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
