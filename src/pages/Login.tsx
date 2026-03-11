import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  UserCheck,
  Eye,
  EyeOff,
  ArrowRight,
  CheckCircle2,
  X,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { getUsers, saveCurrentUser } from '../types/index';

const FEATURES = [
  'AI Lead Scoring — Know your hottest leads instantly',
  'Unified Inbox — WhatsApp, Email & SMS in one place',
  'Auto Follow-ups — Never miss a lead again',
  'JustDial & IndiaMART — Native integration',
];

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [role, setRole]                 = useState('Admin');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState('');

  const handleLogin = (emailParam?: string, passParam?: string) => {
    const loginEmail = emailParam || email;
    const loginPass  = passParam  || password;
    setIsLoading(true);
    setError('');
    setTimeout(() => {
      const users = getUsers();
      const user  = users.find((u) => u.email === loginEmail && u.password === loginPass);
      if (user) {
        saveCurrentUser({ id: user.id, name: user.name, email: user.email, role: user.role, isLoggedIn: true });
        navigate('/dashboard');
      } else {
        setError('Invalid credentials. Use demo buttons above.');
      }
      setIsLoading(false);
    }, 800);
  };

  const quickLogin = (emailVal: string, passVal: string, roleVal: string) => {
    setEmail(emailVal);
    setPassword(passVal);
    setRole(roleVal);
    handleLogin(emailVal, passVal);
  };

  return (
    <div className="min-h-screen flex">

      {/* ══ LEFT PANEL ══════════════════════════════════════ */}
      <div className="hidden md:flex md:w-3/5 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 p-12 text-white">

        {/* Top */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-4xl font-black text-white">Velara</span>
            <span className="text-4xl font-black text-blue-300">CRM</span>
          </div>
          <span className="text-sm text-blue-200 bg-blue-800/40 px-3 py-1 rounded-full w-fit">
            🇮🇳 AI-First • Made for India
          </span>
        </div>

        {/* Middle */}
        <div className="flex flex-col gap-4 my-auto py-10">
          <h2 className="text-3xl font-bold leading-tight">
            Close More Deals with AI Intelligence
          </h2>
          <p className="text-blue-200 text-base">
            The only CRM built for Indian B2B sales teams
          </p>
          <div className="flex flex-col gap-3 mt-2">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
                <span className="text-white text-sm">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <div className="w-10 h-10 rounded-full border-2 border-white bg-blue-500 flex items-center justify-center text-sm font-bold text-white">RK</div>
            <div className="w-10 h-10 rounded-full border-2 border-white bg-purple-500 flex items-center justify-center text-sm font-bold text-white -ml-3">PS</div>
            <div className="w-10 h-10 rounded-full border-2 border-white bg-green-500 flex items-center justify-center text-sm font-bold text-white -ml-3">AM</div>
          </div>
          <div className="flex flex-col gap-0 ml-2">
            <span className="text-white text-sm font-medium">500+ Indian sales teams trust Velara</span>
            <span className="text-yellow-400 text-sm">★★★★★ 4.9/5</span>
          </div>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══════════════════════════════════════ */}
      <div className="w-full md:w-2/5 bg-white flex flex-col justify-center px-8 py-12 md:px-12">
        <div className="w-full max-w-sm mx-auto flex flex-col gap-6">

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-gray-800 font-semibold text-base">Velara CRM</span>
          </div>

          {/* Heading */}
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back 👋</h1>
            <p className="text-gray-500 text-sm">Sign in to your workspace</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-600 text-sm flex-1">{error}</span>
              <button onClick={() => setError('')}>
                <X className="w-4 h-4 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}

          {/* Form */}
          <div className="flex flex-col gap-4">

            {/* Email */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Email address</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@velara.com"
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Password</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword
                    ? <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-gray-600" />
                    : <Eye    className="w-4 h-4 text-gray-400 flex-shrink-0 cursor-pointer hover:text-gray-600" />}
                </button>
              </div>
            </div>

            {/* Role */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Sign in as</label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 bg-white">
                <UserCheck className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 cursor-pointer"
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="Sales">Sales Executive</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
            </div>

            {/* Sign In */}
            <button
              onClick={() => handleLogin()}
              disabled={isLoading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Demo box */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-600" />
              <span className="text-blue-800 font-semibold text-sm">Quick Demo Access</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0">
                <span className="text-xs font-medium text-gray-700">Admin</span>
                <span className="text-xs text-gray-500">admin@velara.com</span>
              </div>
              <button
                onClick={() => quickLogin('admin@velara.com', 'admin123', 'Admin')}
                disabled={isLoading}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors font-medium disabled:opacity-70"
              >
                Login as Admin
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0">
                <span className="text-xs font-medium text-gray-700">Sales</span>
                <span className="text-xs text-gray-500">sneha@velara.com</span>
              </div>
              <button
                onClick={() => quickLogin('sneha@velara.com', 'sales123', 'Sales')}
                disabled={isLoading}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md transition-colors font-medium disabled:opacity-70"
              >
                Login as Sales
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
