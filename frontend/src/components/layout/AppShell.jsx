import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { HeartHandshake, Menu, X, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "../../context/AuthContext.jsx";

// Demo-mode role convenience. Only visible when VITE_DEMO_MODE=true.
// It ONLY navigates — ProtectedRoute + backend authorization still enforce
// the real role, so it can never bypass access control.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
    isActive
      ? "bg-brand-600 text-white shadow-sm"
      : "text-gray-700 hover:bg-brand-50 hover:text-brand-700"
  }`;

function SidebarBody({ nav, flat, onNavigate }) {
  if (flat) {
    return (
      <nav className="space-y-1">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/dashboard"} className={linkClass} onClick={onNavigate}>
            <item.icon className="w-5 h-5 shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    );
  }
  return (
    <nav className="space-y-5">
      {nav.map((group) => (
        <div key={group.section}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted px-3 mb-1.5">
            {group.section}
          </p>
          <div className="space-y-1">
            {group.items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.to === "/command"} className={linkClass} onClick={onNavigate}>
                <item.icon className="w-5 h-5 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function ViewAsSwitcher({ currentRole }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  if (!DEMO_MODE) return null;
  const label = currentRole === "doctor" ? "Officer" : "Complainant";
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
        title="Demo convenience only — real authorization is still enforced"
      >
        VIEW AS: {label} <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-50">
          <button
            onClick={() => { setOpen(false); navigate("/dashboard"); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-brand-50"
          >
            Complainant
          </button>
          <button
            onClick={() => { setOpen(false); navigate("/command"); }}
            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-brand-50"
          >
            Officer
          </button>
          <p className="px-4 py-1.5 text-[11px] text-muted border-t border-gray-100">
            Demo only — requires that role's login.
          </p>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ nav, flat = false, roleLabel, homePath }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const displayName = user?.name && !user.name.startsWith("Guest") ? user.name : roleLabel;

  return (
    <div className="min-h-screen flex bg-brand-50">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-white border-r border-gray-100 fixed inset-y-0 left-0 z-30">
        <button onClick={() => navigate(homePath)} className="flex items-center gap-2.5 px-5 h-16 border-b border-gray-100 text-left">
          <div className="p-2 bg-brand-600 rounded-xl">
            <HeartHandshake className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-ink leading-none">Sahaay</p>
            <p className="text-[11px] text-muted mt-0.5">NHAA Support Triage</p>
          </div>
        </button>
        <div className="flex-1 overflow-y-auto p-4">
          <SidebarBody nav={nav} flat={flat} />
        </div>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
              {(displayName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
              <p className="text-[11px] text-muted">{roleLabel}</p>
            </div>
            <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-risk-critical transition-colors" title="Log out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 h-16 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-brand-600 rounded-xl">
                  <HeartHandshake className="w-5 h-5 text-white" />
                </div>
                <p className="font-bold text-ink">Sahaay</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 text-gray-500" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <SidebarBody nav={nav} flat={flat} onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="p-4 border-t border-gray-100 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
                {(displayName || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink truncate">{displayName}</p>
                <p className="text-[11px] text-muted">{roleLabel}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-risk-critical" title="Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-60">
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100">
          <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
            <button onClick={() => setDrawerOpen(true)} className="lg:hidden p-2 -ml-2 text-gray-600" aria-label="Open menu">
              <Menu className="w-6 h-6" />
            </button>
            <div className="lg:hidden flex items-center gap-2">
              <div className="p-1.5 bg-brand-600 rounded-lg">
                <HeartHandshake className="w-4 h-4 text-white" />
              </div>
              <p className="font-bold text-ink">Sahaay</p>
            </div>
            <div className="flex-1" />
            <ViewAsSwitcher currentRole={user?.role} />
            <span className="hidden sm:inline-flex text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200">
              {roleLabel}
            </span>
          </div>
        </header>
        <main className="grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
