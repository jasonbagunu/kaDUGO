import { useState } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Activity, Droplet, ShieldCheck, BarChart3, AlertCircle, Info } from "lucide-react";
import { Modal, SecondaryButton } from "../components/ui";
import { setSession, peekNotice } from "../lib/session";
import { api, errorMessage, LoginResponse } from "../lib/api";

const features = [
  { icon: Droplet, label: "Donor Management", desc: "Centralized donor records and history" },
  { icon: Activity, label: "Blood Traceability", desc: "Full lifecycle tracking per unit" },
  { icon: ShieldCheck, label: "Testing & Screening", desc: "Integrated blood safety screening" },
  { icon: BarChart3, label: "Analytics & Reports", desc: "Inventory insights and trends" },
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotOpen, setForgotOpen] = useState(false);
  // e.g. "Your session has expired" after being sent back from another page
  const [notice] = useState(() => peekNotice());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { token, user } = await api<LoginResponse>("/auth/login", {
        method: "POST",
        body: { username: email.trim(), password },
      });
      setSession({ userId: user.id, name: user.name, email: user.email, role: user.role, token });
      navigate("/");
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Inter, sans-serif" }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[55%] bg-[#17100F] relative overflow-hidden flex-col">
        {/* Decorative blood drops */}
        <div className="absolute top-[-60px] right-[-60px] w-72 h-72 rounded-full bg-[#7C2D3E]/20 blur-3xl" />
        <div className="absolute bottom-40 left-[-40px] w-48 h-48 rounded-full bg-[#7C2D3E]/15 blur-2xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7C2D3E]/5 blur-3xl" />

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative z-10 flex flex-col h-full px-12 py-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#7C2D3E] rounded-xl flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-2xl" style={{ fontFamily: "Outfit, sans-serif" }}>kaDUGO</div>
              <div className="text-[#9CA3AF] text-xs">Cagayan Valley Regional Blood Center</div>
            </div>
          </div>

          {/* Main copy */}
          <div className="mt-auto mb-auto pt-24">
            <div className="inline-flex items-center gap-2 bg-[#7C2D3E]/20 border border-[#7C2D3E]/40 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-[#E05068] rounded-full animate-pulse" />
              <span className="text-[#E05068] text-xs font-medium">Internal Management Platform</span>
            </div>
            <h1 className="text-4xl font-bold text-white leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
              Digital Blood Record<br />
              Management System
            </h1>
            <p className="text-[#9CA3AF] mt-4 text-base leading-relaxed max-w-md">
              Centralize blood donation records, traceability, testing results, inventory monitoring, and analytics for the CVRBC.
            </p>

            <div className="grid grid-cols-2 gap-3 mt-10">
              {features.map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/8 transition-colors">
                  <div className="w-8 h-8 bg-[#7C2D3E]/30 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4 text-[#E05068]" />
                  </div>
                  <div className="text-white text-sm font-medium">{label}</div>
                  <div className="text-[#9CA3AF] text-xs mt-0.5">{desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex items-center gap-8 pt-8 border-t border-white/10">
            <div>
              <div className="text-white font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>2,847</div>
              <div className="text-[#9CA3AF] text-xs">Registered Donors</div>
            </div>
            <div>
              <div className="text-white font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>182</div>
              <div className="text-[#9CA3AF] text-xs">Usable Blood Units</div>
            </div>
            <div>
              <div className="text-white font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>97.8%</div>
              <div className="text-[#9CA3AF] text-xs">Screening Pass Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-[380px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 bg-[#7C2D3E] rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-[#1C1C2E] font-bold text-xl" style={{ fontFamily: "Outfit, sans-serif" }}>kaDUGO</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-[#1C1C2E]" style={{ fontFamily: "Outfit, sans-serif" }}>Welcome back</h2>
            <p className="text-[#6B7280] text-sm mt-1">Sign in to your kaDUGO account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {notice && !error && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg px-3 py-2.5">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{notice}</span>
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">Username</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your username"
                required
                className="w-full border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1C1C2E] mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full border border-[#E8E5E2] rounded-lg px-4 py-2.5 text-sm text-[#1C1C2E] focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E] placeholder:text-gray-400 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 accent-[#7C2D3E]"
                />
                <span className="text-sm text-[#6B7280]">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm text-[#7C2D3E] hover:text-[#6B2535] font-medium cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7C2D3E] hover:bg-[#6B2535] disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors mt-2 cursor-pointer"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-[#9CA3AF] mt-8 leading-relaxed">
            Authorized personnel only<br />
            Cagayan Valley Regional Blood Center • Department of Health
          </p>
        </div>
      </div>

      {/* Forgot password: resets are done by an administrator */}
      <Modal open={forgotOpen} onClose={() => setForgotOpen(false)} title="Forgot your password?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[#6B7280] leading-relaxed">
            Passwords are reset by your administrator. They can set a new one for you from the Users page.
          </p>
          <ul className="text-sm text-[#1C1C2E] space-y-2">
            <li className="flex gap-2"><span className="w-1.5 h-1.5 mt-2 rounded-full bg-[#7C2D3E] flex-shrink-0" /><span><strong>MedTech</strong> accounts: ask your Admin.</span></li>
            <li className="flex gap-2"><span className="w-1.5 h-1.5 mt-2 rounded-full bg-[#7C2D3E] flex-shrink-0" /><span><strong>Admin</strong> accounts: ask the Super Admin.</span></li>
          </ul>
          <p className="text-xs text-[#9CA3AF]">After signing in with the new password, you can change it yourself in Settings.</p>
          <SecondaryButton onClick={() => setForgotOpen(false)} className="w-full justify-center">Close</SecondaryButton>
        </div>
      </Modal>
    </div>
  );
}
