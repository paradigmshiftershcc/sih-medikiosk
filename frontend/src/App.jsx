import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/layout/Navbar.jsx";
import SessionGuard from "./components/layout/SessionGuard.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import DoctorLogin from "./pages/DoctorLogin.jsx";

// Route-level code splitting: heavy pages load on demand.
const PatientDashboard = lazy(() => import("./pages/PatientDashboard.jsx"));
const IntakeFlow = lazy(() => import("./pages/IntakeFlow.jsx"));
const ConsultationDetail = lazy(() => import("./pages/ConsultationDetail.jsx"));
const DoctorDashboard = lazy(() => import("./pages/DoctorDashboard.jsx"));
const DoctorView = lazy(() => import("./pages/DoctorView.jsx"));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
    <div className="w-9 h-9 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
    <p className="text-sm text-gray-500">Loading...</p>
  </div>
);

// Role-Based Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Navigate
        to={user.role === "doctor" ? "/doctor/dashboard" : "/dashboard"}
        replace
      />
    );
  }
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen flex flex-col bg-brand-50">
          <Navbar />
          <SessionGuard />

          {/* Main Content Area */}
          <main className="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Suspense fallback={<PageLoader />}>
              <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Login />} />
              <Route path="/doctor-login" element={<DoctorLogin />} />

              {/* Patient Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["patient"]}>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/intake"
                element={
                  <ProtectedRoute allowedRoles={["patient"]}>
                    <IntakeFlow />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/consultation/:caseId"
                element={
                  <ProtectedRoute allowedRoles={["patient"]}>
                    <ConsultationDetail />
                  </ProtectedRoute>
                }
              />

              {/* Doctor Routes */}
              <Route
                path="/doctor/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["doctor"]}>
                    <DoctorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/doctor/case/:caseId"
                element={
                  <ProtectedRoute allowedRoles={["doctor"]}>
                    <DoctorView />
                  </ProtectedRoute>
                }
              />

              {/* Legacy Patient View (redirect to new route) */}
              <Route
                path="/doctor/:caseId"
                element={<Navigate to="/consultation/:caseId" replace />}
              />

              {/* Fallback route to catch invalid URLs securely */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
