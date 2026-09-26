import { useNavigate } from "react-router-dom";
import { User, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

export default function ComplainantProfile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-ink">Profile</h1>
        <p className="text-muted mt-1">Your account on this device.</p>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xl shrink-0">
            {(user?.name && !user.name.startsWith("Guest") ? user.name : "C").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-ink flex items-center gap-2">
              <User className="w-4 h-4 text-brand-600" />
              {user?.name || "Complainant"}
            </p>
            <p className="text-sm text-muted">{user?.phone || "No phone on record"}</p>
            <span className="inline-block mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              Complainant
            </span>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-2 text-sm text-muted">
          <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-brand-600" />
          <p>
            You can only see your own cases. Signing out on a shared device
            keeps your information private on this browser.
          </p>
        </div>

        <button
          onClick={handleLogout}
          className="mt-5 flex items-center gap-2 px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-red-50 hover:text-risk-critical transition-colors"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );
}
