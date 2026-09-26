import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import SessionGuard from "./components/layout/SessionGuard.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import { NAV_COMPLAINANT, NAV_OFFICER } from "./components/layout/nav.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import OfficerLogin from "./pages/OfficerLogin.jsx";

// Route-level code splitting: heavy pages load on demand.
const ComplainantDashboard = lazy(() => import("./pages/ComplainantDashboard.jsx"));
const IntakeFlow = lazy(() => import("./pages/IntakeFlow.jsx"));
const CaseStatus = lazy(() => import("./pages/CaseStatus.jsx"));
const MyCases = lazy(() => import("./pages/complainant/MyCases.jsx"));
const LatestCaseRedirect = lazy(() => import("./pages/complainant/LatestCaseRedirect.jsx"));
const SupportPage = lazy(() => import("./pages/complainant/SupportPage.jsx"));
const UpdatesPage = lazy(() => import("./pages/complainant/UpdatesPage.jsx"));
const ComplainantProfile = lazy(() => import("./pages/complainant/ComplainantProfile.jsx"));
const HelpPage = lazy(() => import("./pages/complainant/HelpPage.jsx"));
const OfficerDashboard = lazy(() => import("./pages/officer/OfficerDashboard.jsx"));
const PriorityQueue = lazy(() => import("./pages/officer/PriorityQueue.jsx"));
const OfficerCases = lazy(() => import("./pages/officer/OfficerCases.jsx"));
const OfficerAnalytics = lazy(() => import("./pages/officer/OfficerAnalytics.jsx"));
const PathwaysPage = lazy(() => import("./pages/officer/PathwaysPage.jsx"));
const TrendsPage = lazy(() => import("./pages/officer/TrendsPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/officer/NotificationsPage.jsx"));
const AuditPage = lazy(() => import("./pages/officer/AuditPage.jsx"));
const OfficerProfile = lazy(() => import("./pages/officer/OfficerProfile.jsx"));
const SupportCaseDetail = lazy(() => import("./pages/SupportCaseDetail.jsx"));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="w-9 h-9 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    <p className="text-sm text-muted">Loading...</p>
  </div>
);

// Role-Based Protected Route Wrapper. Backend authorization remains
// authoritative; this only keeps each role inside its own experience.
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="p-8 text-center text-muted">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "doctor" ? "/command" : "/dashboard"}
        replace
      />
    );
  }
  return children;
};

const ComplainantShell = () => (
  <ProtectedRoute allowedRoles={["patient"]}>
    <AppShell nav={NAV_COMPLAINANT} flat roleLabel="Complainant" homePath="/dashboard" />
  </ProtectedRoute>
);

const OfficerShell = () => (
  <ProtectedRoute allowedRoles={["doctor"]}>
    <AppShell nav={NAV_OFFICER} roleLabel="Officer" homePath="/command" />
  </ProtectedRoute>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <SessionGuard />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes (no shell) */}
            <Route path="/" element={<Login />} />
            <Route path="/officer-login" element={<OfficerLogin />} />

            {/* Complainant experience */}
            <Route element={<ComplainantShell />}>
              <Route path="/dashboard" element={<ComplainantDashboard />} />
              <Route path="/intake" element={<IntakeFlow />} />
              <Route path="/cases" element={<MyCases />} />
              <Route path="/cases/latest" element={<LatestCaseRedirect />} />
              <Route path="/cases/:caseId" element={<CaseStatus />} />
              <Route path="/support" element={<SupportPage />} />
              <Route path="/updates" element={<UpdatesPage />} />
              <Route path="/profile" element={<ComplainantProfile />} />
              <Route path="/help" element={<HelpPage />} />
            </Route>

            {/* Officer experience */}
            <Route element={<OfficerShell />}>
              <Route path="/command" element={<OfficerDashboard />} />
              <Route path="/command/queue" element={<PriorityQueue />} />
              <Route path="/command/cases" element={<OfficerCases preset="all" />} />
              <Route path="/command/critical" element={<OfficerCases preset="critical" />} />
              <Route path="/command/assigned" element={<OfficerCases preset="assigned" />} />
              <Route path="/command/review" element={<OfficerCases preset="review" />} />
              <Route path="/command/escalated" element={<OfficerCases preset="escalated" />} />
              <Route path="/command/resolved" element={<OfficerCases preset="resolved" />} />
              <Route path="/command/analytics" element={<OfficerAnalytics />} />
              <Route path="/command/pathways" element={<PathwaysPage />} />
              <Route path="/command/trends" element={<TrendsPage />} />
              <Route path="/command/notifications" element={<NotificationsPage />} />
              <Route path="/command/audit" element={<AuditPage />} />
              <Route path="/command/profile" element={<OfficerProfile />} />
              <Route path="/command/case/:caseId" element={<SupportCaseDetail />} />
            </Route>

            {/* Fallback route to catch invalid URLs securely */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
