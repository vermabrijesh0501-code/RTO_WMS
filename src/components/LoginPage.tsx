import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  Warehouse,
  Sun,
  Moon,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [email, setEmail] = useState(() => {
    return localStorage.getItem('wop_saved_login_email') || 'verma.brijesh0501@gmail.com';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    (location.state as any)?.error || null
  );

  const completeLogin = () => {
    if (rememberMe && email) {
      localStorage.setItem('wop_saved_login_email', email.trim());
    } else {
      localStorage.removeItem('wop_saved_login_email');
    }
    const origin = (location.state as any)?.from?.pathname || '/dashboard';
    navigate(origin, { replace: true });
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await signIn(email.trim(), password);
      if (res.success) {
        completeLogin();
      } else {
        setErrorMessage(res.error || 'Authentication failed. Please check your credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to connect to authentication server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans select-none">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top right theme toggle */}
      <div className="absolute top-5 right-5 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all shadow-sm cursor-pointer"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-purple-400" />}
        </button>
      </div>

      {/* Main 2-Column Container matching original design */}
      <div className="w-full max-w-4xl bg-[#111827] rounded-[28px] shadow-2xl border border-slate-800/80 overflow-hidden relative z-10 flex flex-col md:flex-row">
        {/* Left Column: Purple Gradient Brand Panel */}
        <div className="w-full md:w-[42%] bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#5B21B6] p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden shrink-0">
          {/* Subtle interior glow */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

          {/* Top Brand Header */}
          <div className="relative z-10 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-white shadow-sm">
              <Warehouse className="w-6 h-6" />
            </div>

            <div className="inline-block px-3 py-1 rounded-full bg-white/15 text-white/90 text-[11px] font-mono font-bold tracking-wider uppercase">
              WOP-EMIZA
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight pt-1">
              Warehouse<br />Operations Platform
            </h1>
          </div>

          {/* Middle / Bottom Content */}
          <div className="relative z-10 pt-12 md:pt-20 space-y-6">
            <p className="text-purple-100/80 text-xs sm:text-sm leading-relaxed">
              Secure gateway for enterprise inbound verification, return processing, and real-time inventory management.
            </p>

            <div className="flex items-center gap-2 text-xs text-purple-200/90 font-medium pt-2 border-t border-white/15">
              <ShieldCheck className="w-4 h-4 text-purple-200 shrink-0" />
              <span>Encrypted Shift &amp; Terminal Access</span>
            </div>
          </div>
        </div>

        {/* Right Column: Dark Form Panel */}
        <div className="w-full md:w-[58%] p-8 sm:p-10 flex flex-col justify-between bg-[#111827]">
          <div>
            {/* Header: Title & Terminal Online Badge */}
            <div className="flex items-center justify-between gap-4 mb-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Sign In
              </h2>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Terminal Online</span>
              </span>
            </div>

            <p className="text-slate-400 text-xs sm:text-sm mb-6">
              Enter your enterprise credentials to access the terminal
            </p>

            {/* Error Message Box */}
            {errorMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in-50">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  EMAIL ADDRESS
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="name@emizainc.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="email"
                    className="w-full bg-[#0F172A] border border-slate-700/80 hover:border-slate-600 focus:border-[#8B5CF6] text-sm text-slate-100 rounded-xl px-4 py-3 pl-11 shadow-inner focus:outline-none transition-colors placeholder:text-slate-500"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    autoComplete="current-password"
                    className="w-full bg-[#0F172A] border border-slate-700/80 hover:border-slate-600 focus:border-[#8B5CF6] text-sm text-slate-100 rounded-xl px-4 py-3 pl-11 pr-11 shadow-inner focus:outline-none transition-colors placeholder:text-slate-500"
                  />
                  <Lock className="w-4 h-4 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded bg-[#0F172A] border-slate-700 text-[#8B5CF6] focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400">Remember on this device</span>
                </label>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 px-6 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:bg-[#6D28D9] text-white text-sm font-bold tracking-wide shadow-lg shadow-purple-500/25 hover:shadow-purple-500/35 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Signing In...</span>
                    </>
                  ) : (
                    <>
                      <span>Sign In to Terminal</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Footer note */}
          <div className="mt-8 pt-5 border-t border-slate-800/80 text-center">
            <p className="text-[11px] text-slate-500 font-medium">
              WOP-Emiza Supply Chain Operations &bull; Authorized Personnel Only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

