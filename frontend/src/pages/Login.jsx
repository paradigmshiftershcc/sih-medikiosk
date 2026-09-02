import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import api from '../services/api';
import { Smartphone, KeyRound } from 'lucide-react';

export default function Login() {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/request-otp', { phone });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Error requesting OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(phone, otp);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <Card className="text-center space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-brand-700">Patient Authentication</h2>
          <p className="text-gray-600">Please log in to start your case-taking session.</p>
        </div>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="tel"
                placeholder="10-digit Mobile Number"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={10}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || phone.length < 10}>
              {loading ? 'Sending...' : 'Get OTP'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Enter 6-digit OTP (123456)"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all text-center tracking-widest text-lg font-medium"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
                required
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading || otp.length < 6}>
              {loading ? 'Verifying...' : 'Login securely'}
            </Button>
            <button 
              type="button" 
              onClick={() => setStep(1)} 
              className="text-sm text-brand-600 hover:underline"
            >
              Change Phone Number
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}