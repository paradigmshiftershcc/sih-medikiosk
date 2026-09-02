import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/layout/Navbar.jsx';
import Button from './components/ui/Button.jsx';
import Card from './components/ui/Card.jsx';

const Login = () => (
  <div className="max-w-md mx-auto mt-12">
    <Card className="text-center space-y-6">
      <h2 className="text-2xl font-bold text-brand-700">Welcome to MediKiosk</h2>
      <p className="text-gray-600">Please authenticate to continue.</p>
      <Button className="w-full" size="lg">Login via Mobile OTP</Button>
    </Card>
  </div>
);

const PatientDashboard = () => <div className="p-8 text-2xl font-bold text-brand-700">Patient Dashboard</div>;
const IntakeFlow = () => <div className="p-8 text-2xl font-bold text-brand-700">Intake Flow (Chat & OCR)</div>;
const DoctorView = () => <div className="p-8 text-2xl font-bold text-brand-700">Doctor Summary View</div>;

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-brand-50">
        <Navbar />
        
        {/* Main Content Area */}
        <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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