import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  X,
  Zap,
} from 'lucide-react';
import { ApiError } from '../lib/api';
import { DEMO_ACCOUNTS, DEMO_LOGIN_ENABLED } from '../lib/config';
import { useCrmStore } from '../store/useCrmStore';

const FEATURES = [
  'AI Lead Scoring - know your hottest leads instantly',
  'Unified Inbox - WhatsApp, Email & SMS in one place',
  'Auto Follow-ups - never miss a lead again',
  'JustDial & IndiaMART - native integration',
];

export default function Login() {
  const navigate = useNavigate();
  const login = useCrmStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  /**
   * Authentication happens on the server.
   *
   * The old version did `users.find(u => u.email === x && u.password === y)`
   * against a list held in the browser, and the demo buttons passed the
   * literal string 'redacted' as the password - so they never worked at all,
   * and once the API was reachable neither did the form, because the API
   * (correctly) does not return password hashes.
   */
  async function handleLogin(emailValue = email, passwordValue = password) {
    if (!emailValue.trim() || !passwordValue) {
      setError('Enter your email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(emailValue.trim(), passwordValue);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : err.message
        );
      } else {
        setError('Something went wrong signing in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden md:flex md:w-3/5 flex-col justify-between bg-gradient-to-br from-slate-900 via-blue-900 to-blue-700 p-12 text-white">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-1">
            <span className="text-4xl font-black text-white">Velara</span>
            <span className="text-4xl font-black text-blue-300">CRM</span>
          </div>
          <span className="text-sm text-blue-200 bg-blue-800/40 px-3 py-1 rounded-full w-fit">
            AI-First - Made for India
          </span>
        </div>

        <div className="flex flex-col gap-4 my-auto py-10">
          <h2 className="text-3xl font-bold leading-tight">
            Close More Deals with AI Intelligence
          </h2>
          <p className="text-blue-200 text-base">
            Built for Indian B2B sales teams
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

        <p className="text-blue-200 text-xs">
          Sessions are protected by short-lived tokens and an httpOnly refresh cookie.
        </p>
      </div>

      {/* Right panel */}
      <div className="w-full md:w-2/5 bg-white flex flex-col justify-center px-8 py-12 md:px-12">
        <form
          className="w-full max-w-sm mx-auto flex flex-col gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void handleLogin();
          }}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">V</span>
            </div>
            <span className="text-gray-800 font-semibold text-base">Velara CRM</span>
          </div>

          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-gray-500 text-sm">Sign in to your workspace</p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-red-600 text-sm flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4 text-red-400 hover:text-red-600" />
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="flex-1 text-sm outline-none bg-transparent text-gray-900 placeholder-gray-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
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

          {/*
            Demo shortcuts are behind VITE_ENABLE_DEMO_LOGIN and still perform a
            real server login - they only prefill the email. The password comes
            from whoever seeded the database.
          */}
          {DEMO_LOGIN_ENABLED && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-600" />
                <span className="text-blue-800 font-semibold text-sm">Demo accounts</span>
              </div>
              <p className="text-xs text-gray-600">
                Prefills an email. Enter the password printed by{' '}
                <code className="bg-white px-1 rounded">npm run db:seed</code>.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setError('');
                    }}
                    className="text-xs bg-white border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-100 transition-colors font-medium"
                  >
                    {account.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
