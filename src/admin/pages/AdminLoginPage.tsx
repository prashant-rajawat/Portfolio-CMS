import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth.ts';
import { ShieldCheck, Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

export const AdminLoginPage: React.FC = () => {
  const { login, isAuthenticated, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // If already authenticated as admin, redirect directly to dashboard
  if (!authLoading && isAuthenticated && user?.role === 'admin') {
    const from = (location.state as any)?.from?.pathname || '/admin/dashboard';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login({ email: trimmedEmail, password });
      const from = (location.state as any)?.from?.pathname || '/admin/dashboard';
      navigate(from, { replace: true });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="admin-login-page"
      className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100 font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300"
    >
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">
        {/* Branding Icon & Title */}
        <div className="flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-xl bg-cyan-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950 mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-100">
            Portfolio CMS Admin
          </h2>
          <p className="mt-1.5 text-xs text-slate-400">
            Sign in with authorized administrator credentials
          </p>
        </div>

        {/* Form Card */}
        <div className="mt-8 bg-slate-900 border border-slate-800 py-8 px-6 shadow-xl rounded-2xl sm:px-10">
          <form id="admin-login-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error Message Box */}
            {errorMessage && (
              <div
                id="login-error-alert"
                className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-start space-x-2.5 animate-fadeIn"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Admin Email
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="admin-email-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="admin@example.com"
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="admin-password-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Password
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="admin-password-input"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isSubmitting}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-10 py-2.5 bg-slate-950 border border-slate-700/80 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition disabled:opacity-50"
                />
                <button
                  type="button"
                  id="toggle-password-visibility-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  tabIndex={-1}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                id="admin-login-submit-btn"
                type="submit"
                disabled={isSubmitting || authLoading}
                className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In to Admin Panel</span>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-5 border-t border-slate-800 text-center">
            <p className="text-[11px] text-slate-500">
              Protected by JWT dual-token rotation and bcrypt password hashing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
