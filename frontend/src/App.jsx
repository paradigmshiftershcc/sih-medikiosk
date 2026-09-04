import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Navbar from "./components/layout/Navbar.jsx";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import Login from "./pages/Login.jsx";
import PatientDashboard from "./pages/PatientDashboard.jsx";
import IntakeFlow from "./pages/IntakeFlow.jsx";
import ConsultationDetail from "./pages/ConsultationDetail.jsx";
import DoctorLogin from "./pages/DoctorLogin.jsx";
import DoctorDashboard from "./pages/DoctorDashboard.jsx";
import DoctorView from "./pages/DoctorView.jsx";

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

          {/* Main Content Area */}
          <main className="grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
