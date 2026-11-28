import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  Mail,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim(), password })
      });
      await loginWithToken(res.token, res.user);
      navigate(res.user.role === 'admin' ? '/admin' : res.user.role === 'provider' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/45 to-emerald-50/40">
      <div className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-brand-blue/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-80 w-80 rounded-full bg-brand-green/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Showcase Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-blue-100 shadow-sm text-xs font-bold text-brand-blue">
              <ShieldCheck className="w-4 h-4 text-brand-green shrink-0" />
              <span>{t('auth.login_badge')}</span>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
                {t('auth.login_hero_title')}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 max-w-xl leading-relaxed">
                {t('auth.login_hero_subtitle')}
              </p>
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl shadow-blue-950/15 ring-1 ring-slate-200/90 bg-white p-1.5">
              <img
                src="/login-banner.png"
                alt={t('auth.login_title')}
                className="w-full aspect-video object-cover rounded-[20px] block"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/85 backdrop-blur border border-slate-200/80 px-4 py-3 flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-brand-green flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">{t('auth.trust_verified')}</span>
              </div>
              <div className="rounded-2xl bg-white/85 backdrop-blur border border-slate-200/80 px-4 py-3 flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-brand-blue flex items-center justify-center shrink-0">
                  <Smartphone className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">{t('auth.trust_sync')}</span>
              </div>
              <div className="rounded-2xl bg-white/85 backdrop-blur border border-slate-200/80 px-4 py-3 flex items-center gap-2.5 shadow-sm">
                <div className="w-8 h-8 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-slate-800">{t('auth.trust_fast')}</span>
              </div>
            </div>
          </div>

          {/* Right Elevated Auth Card */}
          <div className="lg:col-span-5">
            <div className="bg-white/95 backdrop-blur-xl rounded-[28px] border border-slate-200/90 shadow-2xl shadow-slate-900/10 overflow-hidden">
              <div className="h-1.5 w-full bg-gradient-to-r from-brand-blue via-brand-green to-brand-orange" />
              <div className="p-7 sm:p-9 space-y-6">
                <div className="flex items-center gap-3.5">
                  <img
                    src="/logo.png"
                    alt={t('brand.name')}
                    className="w-12 h-12 rounded-2xl object-contain bg-white border border-slate-100 shadow-sm p-1 shrink-0"
                  />
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-tight">
                      {t('auth.login_title')}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                      {t('auth.login_card_subtitle')}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      {t('auth.email_or_mobile')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        autoComplete="username"
                        placeholder={t('auth.identifier_placeholder')}
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        required
                        className="w-full border border-slate-200 bg-slate-50/70 focus:bg-white rounded-2xl pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/15 focus:border-brand-blue transition"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-semibold text-slate-700">
                        {t('auth.password')}
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-bold text-brand-blue hover:text-blue-800 hover:underline"
                      >
                        {t('auth.forgot_link')}
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full border border-slate-200 bg-slate-50/70 focus:bg-white rounded-2xl pl-10 pr-11 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-brand-blue/15 focus:border-brand-blue transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-brand-blue to-brand-green hover:from-blue-700 hover:to-emerald-800 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-900/20 inline-flex items-center justify-center gap-2 transition disabled:opacity-60"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{loading ? t('home.loading') : t('auth.submit_login')}</span>
                  </button>
                </form>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="shrink mx-3 text-xs font-bold text-slate-400 tracking-wider">
                    {t('auth.or_divider')}
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <Link
                  to="/register"
                  className="w-full py-3 px-4 rounded-2xl border-2 border-emerald-600/25 bg-emerald-50/60 hover:bg-emerald-50 hover:border-brand-green text-brand-green font-bold text-sm inline-flex items-center justify-center gap-2 transition"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t('auth.no_account')}</span>
                </Link>

                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex items-start gap-2 text-xs text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-brand-green shrink-0 mt-0.5" />
                  <span>{t('auth.otp_forgot_only_note')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [fullAddress, setFullAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'customer' | 'provider'>(
    searchParams.get('role') === 'provider' ? 'provider' : 'customer'
  );
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth.password_mismatch'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          mobileNumber: mobileNumber.trim(),
          fullAddress: fullAddress.trim(),
          password,
          accountRole,
          languagePreference: language,
          bengaliNumerals: true
        })
      });
      await loginWithToken(res.token, res.user);
      navigate(res.user.role === 'provider' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.register_title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.full_name')}</label>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.mobile')}</label>
              <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.address')}</label>
            <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} rows={2} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.password')}</label>
              <input type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.confirm_password')}</label>
              <input type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-2">{t('auth.role_label')}</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountRole('customer')}
                className={`p-3 rounded-xl border text-sm font-bold ${accountRole === 'customer' ? 'border-brand-green bg-emerald-50 text-brand-green' : 'border-slate-200'}`}
              >
                {t('auth.role_customer')}
              </button>
              <button
                type="button"
                onClick={() => setAccountRole('provider')}
                className={`p-3 rounded-xl border text-sm font-bold ${accountRole === 'provider' ? 'border-brand-blue bg-blue-50 text-brand-blue' : 'border-slate-200'}`}
              >
                {t('auth.role_provider')}
              </button>
            </div>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold transition"
          >
            {loading ? t('home.loading') : t('auth.submit_register')}
          </button>
        </form>
        <div className="text-center text-sm">
          <Link to="/login" className="text-brand-blue font-bold hover:underline">
            {t('auth.have_account')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), languagePreference: language })
      });
      setMsg(res.message);
      setStep('reset');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ message: string }>('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), purpose: 'password_reset', languagePreference: language })
      });
      setMsg(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), otp: otp.trim(), newPassword })
      });
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-5">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.forgot_title')}</h1>
        <p className="text-xs text-slate-500">{t('auth.otp_forgot_only_note')}</p>
        {step === 'request' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.email')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-brand-blue text-white font-bold">
              {loading ? t('home.loading') : t('auth.send_otp')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{msg}</div>}
            <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder={t('auth.otp_code')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-center tracking-widest font-bold" />
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('auth.new_password')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-brand-green text-white font-bold">
              {loading ? t('home.loading') : t('auth.reset_password')}
            </button>
            <button type="button" disabled={loading} onClick={handleResendOtp} className="w-full py-2 text-sm text-brand-blue font-semibold">
              {t('auth.resend_otp')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
