import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import Card from "../components/ui/Card.jsx";
import Button from "../components/ui/Button.jsx";
import { ShieldCheck } from "lucide-react";

export default function OfficerLogin() {
  const [phone, setPhone] = useState("1111111111"); // Default to officer seed
  const [otp, setOtp] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { doctorLogin } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await doctorLogin(phone, otp);
      navigate("/command");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-12 px-4">
      <Card className="text-center space-y-6 border-t-8 border-t-brand-700">
        <div className="bg-brand-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-8 h-8 text-brand-700" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-gray-900">
            Support Officer Login
          </h2>
          <p className="text-gray-600 text-sm">
            Use 1111111111, 2222222222, 3333333333, 4444444444, or 5555555555
            for the seeded support officers.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-3">
            <input
              type="tel"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Officer Phone (1111111111)"
              required
            />
            <input
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-500 outline-none"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="OTP (123456)"
              required
            />
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "Authenticating..." : "Access Support Command Center"}
          </Button>
          <p className="text-xs text-gray-400">
            Demo environment: mock OTP <code>123456</code>.
          </p>
        </form>
      </Card>
    </div>
  );
}