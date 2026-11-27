import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { User } from '../types';

export const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      await loginWithToken(res.token, res.user);
      navigate(res.user.role === 'admin' ? '/admin' : res.user.role === 'provider' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.toLowerCase().includes('otp')) {
        navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.login_title')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="text-right">
            <Link to="/forgot-password" className="text-xs font-semibold text-brand-blue hover:underline">
              {t('auth.forgot_link')}
            </Link>
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-brand-blue hover:bg-blue-800 text-white font-bold transition"
          >
            {loading ? t('home.loading') : t('auth.submit_login')}
          </button>
        </form>
        <div className="text-center text-sm">
          <Link to="/register" className="text-brand-green font-bold hover:underline">
            {t('auth.no_account')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
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
      await apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          mobileNumber,
          fullAddress,
          password,
          accountRole,
          languagePreference: language,
          bengaliNumerals: true
        })
      });
      navigate(`/verify-otp?email=${encodeURIComponent(email)}`);
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
              <label className="block text-sm font-semibold mb-1">{t('auth.email')}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.mobile')}</label>
              <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
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

export const VerifyOtpPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, loginWithToken } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp, purpose: 'register_verify' })
      });
      await loginWithToken(res.token, res.user);
      navigate(res.user.role === 'provider' ? '/provider/dashboard' : '/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email, purpose: 'register_verify', languagePreference: language })
      });
      setMessage(res.message);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-5">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.otp_title')}</h1>
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">{t('auth.otp_code')}</label>
            <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-center tracking-widest text-xl font-bold" />
          </div>
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          {message && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{message}</div>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl bg-brand-green text-white font-bold">
            {t('auth.verify_otp')}
          </button>
          <button type="button" onClick={handleResend} className="w-full py-2 text-sm text-brand-blue font-semibold">
            {t('auth.resend_otp')}
          </button>
        </form>
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

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiRequest<{ message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email, languagePreference: language })
      });
      setMsg(res.message);
      setStep('reset');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp, newPassword })
      });
      navigate('/login');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-5">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.forgot_title')}</h1>
        {step === 'request' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.email')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
            <button type="submit" className="w-full py-3 rounded-xl bg-brand-blue text-white font-bold">{t('auth.send_otp')}</button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">{msg}</div>}
            <input type="text" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} placeholder={t('auth.otp_code')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            <input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder={t('auth.new_password')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
            {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
            <button type="submit" className="w-full py-3 rounded-xl bg-brand-green text-white font-bold">{t('auth.reset_password')}</button>
          </form>
        )}
      </div>
    </div>
  );
};
