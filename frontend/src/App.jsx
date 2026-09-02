import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Placeholder imports for pages we will build
const Login = () => <div className="p-8 text-2xl font-bold text-brand-700">Login Page</div>;
const PatientDashboard = () => <div className="p-8 text-2xl font-bold text-brand-700">Patient Dashboard</div>;
const IntakeFlow = () => <div className="p-8 text-2xl font-bold text-brand-700">Intake Flow (Chat & OCR)</div>;
const DoctorView = () => <div className="p-8 text-2xl font-bold text-brand-700">Doctor Summary View</div>;

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* We will add a global Navbar here in Phase 1 */}
        <main className="grow">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<PatientDashboard />} />
            <Route path="/intake" element={<IntakeFlow />} />
            <Route path="/doctor" element={<DoctorView />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;