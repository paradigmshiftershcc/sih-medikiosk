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

// Inline placeholders for now
const IntakeFlow = () => (
  <div className="p-8 text-2xl font-bold text-brand-700">
    Intake Flow (Chat & OCR)
  </div>
);
const DoctorView = () => (
  <div className="p-8 text-2xl font-bold text-brand-700">
    Doctor Summary View
  </div>
);

// Protected Route Wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading)
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
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
              <Route path="/" element={<Login />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <PatientDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/intake"
                element={
                  <ProtectedRoute>
                    <IntakeFlow />
                  </ProtectedRoute>
                }
              />
              <Route path="/doctor" element={<DoctorView />} />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
