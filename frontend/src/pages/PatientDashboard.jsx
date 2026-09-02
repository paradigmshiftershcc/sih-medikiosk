import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import { FileText, Clock, ChevronRight, Leaf } from 'lucide-react';

export default function PatientDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [ayushMode, setAyushMode] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-brand-700">Welcome, {user?.name}</h1>
          <p className="text-gray-600 mt-1">Manage your health records and start new consultations.</p>
        </div>
        <button onClick={logout} className="text-sm text-red-600 hover:underline font-medium">
          Logout
        </button>
      </div>

      <Card className="border-l-4 border-l-brand-500">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-lg text-gray-800">ABDM / ABHA Identity</h3>
            <p className="text-gray-500 text-sm">Your health records are securely linked.</p>
          </div>
          <div className="bg-brand-50 text-brand-700 px-4 py-2 rounded-lg font-mono font-medium border border-brand-100">
            {user?.abhaId || 'Pending Generation'}
          </div>
        </div>
      </Card>

      <h2 className="text-xl font-semibold text-gray-800 mt-8 mb-4">Actions</h2>
      
      {/* AYUSH Toggle */}
      <div className="mb-6 flex items-center justify-between bg-green-50 border border-green-200 p-4 rounded-2xl transition-all">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 p-2 rounded-lg text-green-700">
            <Leaf className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-green-900">AYUSH Consultation</h3>
            <p className="text-green-700 text-sm hidden sm:block">Enable Ayurvedic profiling (Dashavidha Pariksha)</p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={ayushMode}
            onChange={(e) => setAyushMode(e.target.checked)}
          />
          <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600"></div>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        
        {/* Primary Action */}
        <button 
          onClick={() => navigate('/intake', { state: { ayushMode } })}
          className="text-left flex flex-col justify-between bg-brand-600 text-white p-6 rounded-2xl shadow-sm hover:bg-brand-700 transition-colors group h-40"
        >
          <div className="bg-white/20 w-fit p-3 rounded-xl">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex items-center justify-between mt-4">
            <div>
              <h3 className="text-lg font-bold">Start Case Taking</h3>
              <p className="text-brand-100 text-sm">Create a summary for the doctor</p>
            </div>
            <ChevronRight className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Disabled secondary action (mocking past records) */}
        <button 
          disabled
          className="text-left flex flex-col justify-between bg-white border border-gray-200 p-6 rounded-2xl opacity-60 cursor-not-allowed h-40"
        >
          <div className="bg-gray-100 w-fit p-3 rounded-xl">
            <Clock className="w-6 h-6 text-gray-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-lg font-bold text-gray-800">Past Consultations</h3>
            <p className="text-gray-500 text-sm">No past records found.</p>
          </div>
        </button>
      </div>
    </div>
  );
}