import { Link, useLocation } from "react-router-dom";
import { HeartHandshake, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

export default function Navbar() {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Hide the full navbar on the intake flow to keep the complainant calm.
  const isIntakeFlow = location.pathname === "/intake";
  const isPublic =
    location.pathname === "/" || location.pathname === "/officer-login";

  return (
    <header className="bg-white border-b border-brand-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <Link to="/" className="flex items-center gap-2 text-brand-700">
          <div className="bg-brand-100 p-2 rounded-lg">
            <HeartHandshake className="w-5 h-5 text-brand-600" />
          </div>
          <div className="leading-tight">
            <span className="font-bold text-xl tracking-tight block">
              Sahaay
            </span>
            <span className="text-[10px] text-muted font-medium hidden sm:block">
              AI-Assisted Stress &amp; Trauma Triage
            </span>
          </div>
        </Link>

        {/* Auth State / Right side nav */}
        <div className="flex items-center gap-4">
          {isPublic && !user && (
            <Link
              to="/officer-login"
              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 px-3 py-2 rounded-lg hover:bg-brand-50 transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Support Officer</span>
            </Link>
          )}

          {!isIntakeFlow && user && (
            <div className="flex items-center gap-4">
              {user.role === "doctor" && (
                <div className="flex items-center gap-1.5 sm:gap-2 bg-brand-50 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-brand-200">
                  <ShieldCheck className="w-3 h-3 sm:w-4 sm:h-4 text-brand-600" />
                  <span className="text-xs sm:text-sm font-medium text-brand-700">
                    Support Officer
                  </span>
                </div>
              )}
              <div className="hidden sm:block text-sm font-medium text-ink">
                {user.name}
              </div>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}