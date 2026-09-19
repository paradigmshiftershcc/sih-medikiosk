import { Clock, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSessionTimeout } from "../../hooks/useSessionTimeout";

// Renders nothing until the inactivity warning threshold is reached, then
// shows a countdown prompt. Logging out (or any activity) dismisses it.
export default function SessionGuard() {
  const { user, logout } = useAuth();
  const { warning } = useSessionTimeout({
    enabled: Boolean(user),
    onTimeout: logout,
  });

  if (!user || !warning) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-amber-50 border border-amber-200 shadow-xl rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Clock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
        <p className="text-sm text-amber-900">
          You have been inactive. For your privacy, you will be signed out
          shortly.
        </p>
      </div>
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors"
      >
        <LogOut className="w-4 h-4" /> Sign out now
      </button>
    </div>
  );
}
