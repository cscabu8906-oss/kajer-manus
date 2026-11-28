import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowLeft,
  Bell,
  CalendarCheck,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquareWarning,
  RefreshCw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  Users,
  Wrench
} from 'lucide-react';
import { apiRequest, formatInr, toLocaleDigits } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS } from '../components/CategoryIcon';
import type { ServiceItem, User, UserRole } from '../types';

type AdminTab =
  | 'stats'
  | 'providers'
  | 'users'
  | 'bookings'
  | 'categories'
  | 'services'
  | 'reviews'
  | 'complaints'
  | 'cms'
  | 'broadcast'
  | 'audit';

interface AdminServiceRow extends ServiceItem {
  is_active?: boolean;
}

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage, loginWithToken, logout } = useAuth();

  // Separate Admin Login form state (zero hardcoded credentials)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [tab, setTab] = useState<AdminTab>('stats');
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, unknown>>>([]);
  const [services, setServices] = useState<AdminServiceRow[]>([]);
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [complaints, setComplaints] = useState<Array<Record<string, unknown>>>([]);
  const [complaintNotes, setComplaintNotes] = useState<Record<string, string>>({});
  const [complaintStatuses, setComplaintStatuses] = useState<Record<string, string>>({});
  const [cmsEntries, setCmsEntries] = useState<Array<{ key: string; value_bn: string; value_en: string }>>([]);
  const [recentNotifications, setRecentNotifications] = useState<Array<Record<string, unknown>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [health, setHealth] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  // CMS form
  const [cmsKey, setCmsKey] = useState('hero_headline');
  const [cmsBn, setCmsBn] = useState('');
  const [cmsEn, setCmsEn] = useState('');

  // Service CRUD form
  const [editSvcId, setEditSvcId] = useState<string | null>(null);
  const [svcCatSlug, setSvcCatSlug] = useState<string>('electrician');
  const [svcTitleBn, setSvcTitleBn] = useState('');
  const [svcTitleEn, setSvcTitleEn] = useState('');
  const [svcDescBn, setSvcDescBn] = useState('');
  const [svcDescEn, setSvcDescEn] = useState('');
  const [svcProviderBn, setSvcProviderBn] = useState('কাজের মানুষ কর্মী');
  const [svcProviderEn, setSvcProviderEn] = useState('Kajer Manus Pro');
  const [svcAreaBn, setSvcAreaBn] = useState('কলকাতা');
  const [svcAreaEn, setSvcAreaEn] = useState('Kolkata');
  const [svcPrice, setSvcPrice] = useState(299);
  const [svcDuration, setSvcDuration] = useState(60);
  const [svcActive, setSvcActive] = useState(true);

  // Category upsert form
  const [catSlug, setCatSlug] = useState('');
  const [catNameBn, setCatNameBn] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catDescBn, setCatDescBn] = useState('');
  const [catDescEn, setCatDescEn] = useState('');
  const [catActive, setCatActive] = useState(true);

  // Broadcast form
  const [bcastTitleBn, setBcastTitleBn] = useState('');
  const [bcastTitleEn, setBcastTitleEn] = useState('');
  const [bcastBodyBn, setBcastBodyBn] = useState('');
  const [bcastBodyEn, setBcastBodyEn] = useState('');

  const loadAdminData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [sRes, pRes, uRes, bRes, cRes, svcRes, rRes, compRes, cmsRes, notifRes, aRes, hRes] = await Promise.all([
        apiRequest<{ stats: Record<string, number> }>('/admin/stats'),
        apiRequest<{ providers: Array<Record<string, unknown>> }>('/admin/providers'),
        apiRequest<{ users: Array<Record<string, unknown>> }>('/admin/users'),
        apiRequest<{ bookings: Array<Record<string, unknown>> }>('/admin/bookings'),
        apiRequest<{ categories: Array<Record<string, unknown>> }>('/admin/categories'),
        apiRequest<{ services: AdminServiceRow[] }>('/admin/services').catch(() =>
          apiRequest<{ services: AdminServiceRow[] }>('/services')
        ),
        apiRequest<{ reviews: Array<Record<string, unknown>> }>('/admin/reviews'),
        apiRequest<{ complaints: Array<Record<string, unknown>> }>('/admin/complaints'),
        apiRequest<{ content: Array<{ key: string; value_bn: string; value_en: string }> }>('/content'),
        apiRequest<{ notifications: Array<Record<string, unknown>> }>('/admin/notifications').catch(() => ({ notifications: [] })),
        apiRequest<{ logs: Array<Record<string, unknown>> }>('/admin/audit-logs'),
        apiRequest<Record<string, unknown>>('/admin/health').catch(() =>
          apiRequest<Record<string, unknown>>('/health')
        )
      ]);
      setStats(sRes.stats);
      setProviders(pRes.providers);
      setUsers(uRes.users);
      setBookings(bRes.bookings);
      setCategories(cRes.categories);
      setServices(svcRes.services);
      setReviews(rRes.reviews);
      setComplaints(compRes.complaints);
      const nextNotes: Record<string, string> = {};
      const nextStatuses: Record<string, string> = {};
      compRes.complaints.forEach((c) => {
        nextNotes[String(c.id)] = String(c.admin_note || '');
        nextStatuses[String(c.id)] = String(c.status || 'open');
      });
      setComplaintNotes(nextNotes);
      setComplaintStatuses(nextStatuses);
      setCmsEntries(cmsRes.content);
      setRecentNotifications(notifRes.notifications);
      setAuditLogs(aRes.logs);
      setHealth(hRes);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadAdminData();
    }
  }, [user, loadAdminData]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await apiRequest<{ token: string; user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: loginIdentifier.trim(), password: loginPassword })
      });
      if (res.user.role !== 'admin') {
        setLoginError(t('admin.not_admin_error'));
        return;
      }
      await loginWithToken(res.token, res.user);
      setLoginPassword('');
    } catch (err) {
      setLoginError((err as Error).message);
    } finally {
      setLoginSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">{t('home.loading')}</div>;
  }

  // Separate Admin Login Screen when unauthenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6">
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-brand-blue">
              <ArrowLeft className="w-4 h-4" />
              <span>{t('admin.back_to_site')}</span>
            </Link>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => switchLanguage('bn')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${language === 'bn' ? 'bg-brand-green text-white border-brand-green' : 'bg-white border-slate-200'}`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => switchLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${language === 'en' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200'}`}
              >
                English
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-brand-blue text-white flex items-center justify-center shadow">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900">{t('admin.login_title')}</h1>
              <p className="text-xs text-slate-500">{t('admin.login_subtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.email_or_mobile')}</label>
              <input
                type="text"
                autoComplete="username"
                value={loginIdentifier}
                onChange={(e) => setLoginIdentifier(e.target.value)}
                placeholder={t('auth.identifier_placeholder')}
                required
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('auth.password')}</label>
              <input
                type="password"
                autoComplete="current-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm"
              />
            </div>
            {loginError && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{loginError}</div>}
            <button
              type="submit"
              disabled={loginSubmitting}
              className="w-full py-3 rounded-xl bg-brand-blue hover:bg-blue-800 text-white font-bold transition"
            >
              {loginSubmitting ? t('home.loading') : t('auth.submit_login')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Logged in as non-admin: clear RBAC notice + Switch Account button
  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">{t('admin.access_denied_title')}</h1>
          <p className="text-sm text-slate-600">{t('admin.access_denied_desc')}</p>
          <div className="text-xs text-slate-500">
            {user.email} ({user.role})
          </div>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={logout}
              className="w-full py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-sm"
            >
              {t('admin.switch_account')}
            </button>
            <Link to="/" className="w-full py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold text-sm">
              {t('admin.back_to_site')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleApproveProvider = async (id: string, decision: 'approved' | 'rejected') => {
    setError('');
    setMsg('');
    try {
      await apiRequest(`/admin/providers/${id}/approve`, {
        method: 'PATCH',
        body: JSON.stringify({ decision })
      });
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateUser = async (id: string, payload: { role?: UserRole; isVerified?: boolean }) => {
    setError('');
    setMsg('');
    try {
      await apiRequest(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateBookingStatus = async (id: string, status: string) => {
    setError('');
    setMsg('');
    try {
      await apiRequest(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await apiRequest('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          slug: catSlug.trim(),
          nameBn: catNameBn,
          nameEn: catNameEn,
          descriptionBn: catDescBn,
          descriptionEn: catDescEn,
          isActive: catActive
        })
      });
      setCatSlug('');
      setCatNameBn('');
      setCatNameEn('');
      setCatDescBn('');
      setCatDescEn('');
      setCatActive(true);
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const resetServiceForm = () => {
    setEditSvcId(null);
    setSvcCatSlug('electrician');
    setSvcTitleBn('');
    setSvcTitleEn('');
    setSvcDescBn('');
    setSvcDescEn('');
    setSvcProviderBn('কাজের মানুষ কর্মী');
    setSvcProviderEn('Kajer Manus Pro');
    setSvcAreaBn('কলকাতা');
    setSvcAreaEn('Kolkata');
    setSvcPrice(299);
    setSvcDuration(60);
    setSvcActive(true);
  };

  const startEditService = (svc: AdminServiceRow) => {
    setEditSvcId(svc.id);
    setSvcCatSlug(svc.category_slug);
    setSvcTitleBn(svc.title_bn);
    setSvcTitleEn(svc.title_en);
    setSvcDescBn(svc.description_bn);
    setSvcDescEn(svc.description_en);
    setSvcProviderBn(svc.provider_name_bn);
    setSvcProviderEn(svc.provider_name_en);
    setSvcAreaBn(svc.area_bn);
    setSvcAreaEn(svc.area_en);
    setSvcPrice(svc.base_price_inr);
    setSvcDuration(svc.duration_minutes);
    setSvcActive(svc.is_active !== false);
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await apiRequest('/admin/services', {
        method: 'POST',
        body: JSON.stringify({
          ...(editSvcId ? { id: editSvcId } : {}),
          categorySlug: svcCatSlug,
          titleBn: svcTitleBn,
          titleEn: svcTitleEn,
          descriptionBn: svcDescBn,
          descriptionEn: svcDescEn,
          providerNameBn: svcProviderBn,
          providerNameEn: svcProviderEn,
          areaBn: svcAreaBn,
          areaEn: svcAreaEn,
          basePriceInr: Number(svcPrice),
          durationMinutes: Number(svcDuration),
          isActive: svcActive
        })
      });
      resetServiceForm();
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleReviewVisibility = async (id: string, currentVisible: boolean) => {
    setError('');
    try {
      await apiRequest(`/admin/reviews/${id}/visibility`, {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: !currentVisible })
      });
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleUpdateComplaint = async (id: string) => {
    setError('');
    setMsg('');
    try {
      await apiRequest(`/admin/complaints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: complaintStatuses[id] || 'resolved',
          adminNote: complaintNotes[id] || ''
        })
      });
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      await apiRequest('/admin/content', {
        method: 'PUT',
        body: JSON.stringify({ key: cmsKey, valueBn: cmsBn, valueEn: cmsEn })
      });
      setCmsBn('');
      setCmsEn('');
      setMsg(t('admin.saved_msg'));
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMsg('');
    try {
      const res = await apiRequest<{ sentTo: number }>('/admin/notifications/broadcast', {
        method: 'POST',
        body: JSON.stringify({
          titleBn: bcastTitleBn,
          titleEn: bcastTitleEn,
          bodyBn: bcastBodyBn,
          bodyEn: bcastBodyEn
        })
      });
      setBcastTitleBn('');
      setBcastTitleEn('');
      setBcastBodyBn('');
      setBcastBodyEn('');
      setMsg(`${t('admin.broadcast_sent')} (${toLocaleDigits(res.sentTo, language)})`);
      loadAdminData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const navItems: Array<{ key: AdminTab; icon: React.ReactNode }> = [
    { key: 'stats', icon: <LayoutDashboard className="w-4 h-4" /> },
    { key: 'providers', icon: <UserCheck className="w-4 h-4" /> },
    { key: 'users', icon: <Users className="w-4 h-4" /> },
    { key: 'bookings', icon: <CalendarCheck className="w-4 h-4" /> },
    { key: 'categories', icon: <FolderKanban className="w-4 h-4" /> },
    { key: 'services', icon: <Wrench className="w-4 h-4" /> },
    { key: 'reviews', icon: <Star className="w-4 h-4" /> },
    { key: 'complaints', icon: <MessageSquareWarning className="w-4 h-4" /> },
    { key: 'cms', icon: <FileText className="w-4 h-4" /> },
    { key: 'broadcast', icon: <Bell className="w-4 h-4" /> },
    { key: 'audit', icon: <ScrollText className="w-4 h-4" /> }
  ];

  const q = searchTerm.trim().toLowerCase();
  const matchesQuery = (...vals: Array<unknown>) =>
    !q || vals.some((v) => String(v || '').toLowerCase().includes(q));

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col lg:flex-row">
      {/* Separate Dark Admin Sidebar */}
      <aside className="bg-slate-900 text-slate-200 lg:w-64 shrink-0 flex flex-col justify-between p-4">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 pt-1">
            <img src="/logo.jpg" alt={t('brand.name')} className="w-10 h-10 rounded-xl object-cover ring-2 ring-emerald-400/40" />
            <div>
              <div className="font-extrabold text-white leading-tight">{t('brand.name')}</div>
              <div className="text-[11px] text-emerald-300 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('nav.admin_dashboard')}</span>
              </div>
            </div>
          </div>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  tab === item.key
                    ? 'bg-brand-green text-white shadow'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span>{t(`admin.tabs.${item.key}`)}</span>
              </button>
            ))}
          </nav>
        </div>

        <div className="hidden lg:flex flex-col gap-2 pt-6 border-t border-slate-800 text-xs">
          <div className="px-2 text-slate-400 truncate">{user.email}</div>
          <Link to="/" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span>{t('admin.back_to_site')}</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-200 font-semibold"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Main Admin Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-slate-200 px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">{t('dashboard.admin_title')}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => switchLanguage('bn')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${language === 'bn' ? 'bg-brand-green text-white border-brand-green' : 'bg-white border-slate-200'}`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => switchLanguage('en')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${language === 'en' ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200'}`}
              >
                English
              </button>
            </div>
            <button
              type="button"
              onClick={loadAdminData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.refresh')}</span>
            </button>
            <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-brand-green text-xs font-bold">
              {t('admin.api_status')}: {String(health.status || 'ok')} • {t('admin.db_status')}: {String(health.database || 'connected')}
            </span>
            <Link to="/" className="lg:hidden px-3 py-1.5 rounded-xl border text-xs font-bold text-slate-700">
              {t('admin.back_to_site')}
            </Link>
            <button type="button" onClick={logout} className="lg:hidden px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold">
              {t('nav.logout')}
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-8 space-y-6">
          {msg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">{msg}</div>}
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">{error}</div>}

          {['providers', 'users', 'bookings', 'complaints', 'services'].includes(tab) && (
            <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 max-w-md">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('admin.search_placeholder')}
                className="w-full text-sm focus:outline-none"
              />
            </div>
          )}

          {tab === 'stats' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(stats).map(([k, v]) => (
                  <div key={k} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-xs text-slate-500 font-semibold">{t(`admin.stats.${k}`, k)}</div>
                    <div className="text-3xl font-extrabold text-brand-blue mt-1">{toLocaleDigits(v, language)}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-brand-green" />
                  <span>{t('admin.health_title')}</span>
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">{t('admin.db_name')}</div>
                    <div className="font-bold text-slate-900">{String(health.dbName || 'kajermanus_db')}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">{t('admin.node_version')}</div>
                    <div className="font-bold text-slate-900">{String(health.nodeVersion || 'v20')}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">{t('admin.uptime')}</div>
                    <div className="font-bold text-slate-900">{toLocaleDigits(String(health.uptimeSeconds ?? 0), language)}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50">
                    <div className="text-xs text-slate-500">{t('admin.memory_rss')}</div>
                    <div className="font-bold text-slate-900">{toLocaleDigits(String(health.memoryRssMb ?? 0), language)}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'providers' && (
            <div className="bg-white rounded-2xl border p-6 space-y-3">
              {providers.filter((p) => matchesQuery(p.full_name, p.email, p.service_location_bn, p.service_location_en)).length === 0 ? (
                <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
              ) : (
                providers
                  .filter((p) => matchesQuery(p.full_name, p.email, p.service_location_bn, p.service_location_en))
                  .map((p) => (
                    <div key={String(p.id)} className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-bold">{String(p.full_name)} ({String(p.email)})</div>
                        <div className="text-xs text-slate-500">
                          {t('admin.status')}: <span className="font-semibold">{String(p.approval_status)}</span> •{' '}
                          {toLocaleDigits(String(p.mobile_number || ''), language)} •{' '}
                          {language === 'bn' ? String(p.service_location_bn || '') : String(p.service_location_en || '')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleApproveProvider(String(p.id), 'approved')} className="px-3 py-1.5 rounded-xl bg-brand-green text-white text-xs font-bold">
                          {t('admin.approve')}
                        </button>
                        <button type="button" onClick={() => handleApproveProvider(String(p.id), 'rejected')} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold">
                          {t('admin.reject')}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {tab === 'users' && (
            <div className="bg-white rounded-2xl border p-6 space-y-3">
              {users
                .filter((u) => matchesQuery(u.full_name, u.email, u.mobile_number, u.role))
                .map((u) => {
                  const uid = String(u.id);
                  const isSelf = uid === user.id;
                  const verified = Boolean(u.is_verified);
                  return (
                    <div key={uid} className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div>
                        <div className="font-bold">{String(u.full_name)} — {String(u.email)}</div>
                        <div className="text-xs text-slate-500">
                          {toLocaleDigits(String(u.mobile_number || ''), language)} • {String(u.full_address || '')}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={String(u.role)}
                          disabled={isSelf}
                          onChange={(e) => handleUpdateUser(uid, { role: e.target.value as UserRole })}
                          aria-label={t('admin.role')}
                          className="border rounded-xl px-2.5 py-1.5 text-xs font-bold bg-white disabled:opacity-60"
                        >
                          <option value="customer">customer</option>
                          <option value="provider">provider</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleUpdateUser(uid, { isVerified: !verified })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold ${verified ? 'bg-emerald-100 text-brand-green' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {verified ? t('admin.verified') : t('admin.unverified')}
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {tab === 'bookings' && (
            <div className="bg-white rounded-2xl border p-6 space-y-3">
              {bookings.filter((b) => matchesQuery(b.service_title_bn, b.service_title_en, b.customer_name, b.customer_phone, b.status)).length === 0 ? (
                <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
              ) : (
                bookings
                  .filter((b) => matchesQuery(b.service_title_bn, b.service_title_en, b.customer_name, b.customer_phone, b.status))
                  .map((b) => (
                    <div key={String(b.id)} className="p-3 rounded-xl border text-sm flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold">
                          {language === 'bn' ? String(b.service_title_bn) : String(b.service_title_en)} — {formatInr(Number(b.amount_inr || 0), language)}
                        </div>
                        <div className="text-xs text-slate-500">
                          {String(b.customer_name)} ({toLocaleDigits(String(b.customer_phone || ''), language)}) • {toLocaleDigits(String(b.preferred_date || ''), language)}
                        </div>
                      </div>
                      <select
                        value={String(b.status)}
                        onChange={(e) => handleUpdateBookingStatus(String(b.id), e.target.value)}
                        className="border rounded-xl px-3 py-1.5 text-xs font-bold bg-blue-50 text-brand-blue"
                      >
                        <option value="pending" disabled>{t('booking.pending')}</option>
                        <option value="accepted">{t('booking.accepted')}</option>
                        <option value="in_progress">{t('booking.in_progress')}</option>
                        <option value="completed">{t('booking.completed')}</option>
                        <option value="rejected">{t('booking.rejected')}</option>
                        <option value="cancelled">{t('booking.cancelled')}</option>
                      </select>
                    </div>
                  ))
              )}
            </div>
          )}

          {tab === 'categories' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSaveCategory} className="bg-white rounded-2xl border p-6 space-y-3">
                <h2 className="font-bold text-slate-900">{t('admin.category_form_title')}</h2>
                <input type="text" value={catSlug} onChange={(e) => setCatSlug(e.target.value)} placeholder={t('admin.cat_slug')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={catNameBn} onChange={(e) => setCatNameBn(e.target.value)} placeholder={t('admin.title_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} placeholder={t('admin.title_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={catDescBn} onChange={(e) => setCatDescBn(e.target.value)} placeholder={t('admin.desc_bn')} className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={catDescEn} onChange={(e) => setCatDescEn(e.target.value)} placeholder={t('admin.desc_en')} className="w-full border rounded-xl px-3 py-2 text-sm" />
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={catActive} onChange={(e) => setCatActive(e.target.checked)} className="w-4 h-4 accent-brand-green" />
                  <span>{t('admin.active')}</span>
                </label>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-green text-white text-sm font-bold">{t('admin.save_category')}</button>
              </form>
              <div className="lg:col-span-2 bg-white rounded-2xl border p-6 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
                {categories.map((c) => (
                  <div key={String(c.id)} className="p-3 rounded-xl border flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold">{String(c.name_bn)} / {String(c.name_en)}</div>
                      <div className="text-xs text-slate-500">
                        {String(c.slug)} • {c.is_active === false ? t('admin.inactive') : t('admin.active')}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCatSlug(String(c.slug));
                        setCatNameBn(String(c.name_bn));
                        setCatNameEn(String(c.name_en));
                        setCatDescBn(String(c.description_bn || ''));
                        setCatDescEn(String(c.description_en || ''));
                        setCatActive(c.is_active !== false);
                      }}
                      className="text-xs font-bold text-brand-blue hover:underline"
                    >
                      {t('admin.edit_btn')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'services' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <form onSubmit={handleSaveService} className="bg-white rounded-2xl border p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-900">{t('admin.service_form_title')}</h2>
                  {editSvcId && (
                    <button type="button" onClick={resetServiceForm} className="text-xs text-brand-blue font-bold">
                      {t('admin.clear_btn')}
                    </button>
                  )}
                </div>
                <select value={svcCatSlug} onChange={(e) => setSvcCatSlug(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm">
                  {CATEGORY_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>{t(`categories.${slug}`)}</option>
                  ))}
                </select>
                <input type="text" value={svcTitleBn} onChange={(e) => setSvcTitleBn(e.target.value)} placeholder={t('admin.title_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={svcTitleEn} onChange={(e) => setSvcTitleEn(e.target.value)} placeholder={t('admin.title_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <textarea value={svcDescBn} onChange={(e) => setSvcDescBn(e.target.value)} rows={2} placeholder={t('admin.desc_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <textarea value={svcDescEn} onChange={(e) => setSvcDescEn(e.target.value)} rows={2} placeholder={t('admin.desc_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={svcProviderBn} onChange={(e) => setSvcProviderBn(e.target.value)} placeholder={t('admin.provider_bn')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                  <input type="text" value={svcProviderEn} onChange={(e) => setSvcProviderEn(e.target.value)} placeholder={t('admin.provider_en')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                  <input type="text" value={svcAreaBn} onChange={(e) => setSvcAreaBn(e.target.value)} placeholder={t('admin.area_bn')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                  <input type="text" value={svcAreaEn} onChange={(e) => setSvcAreaEn(e.target.value)} placeholder={t('admin.area_en')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                  <input type="number" min={0} value={svcPrice} onChange={(e) => setSvcPrice(Number(e.target.value))} placeholder={t('admin.price_inr')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                  <input type="number" min={15} value={svcDuration} onChange={(e) => setSvcDuration(Number(e.target.value))} placeholder={t('admin.duration_min')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={svcActive} onChange={(e) => setSvcActive(e.target.checked)} className="w-4 h-4 accent-brand-blue" />
                  <span>{t('admin.active')}</span>
                </label>
                <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold">{t('admin.save_service')}</button>
              </form>

              <div className="lg:col-span-2 bg-white rounded-2xl border p-6 space-y-3">
                {services
                  .filter((s) => matchesQuery(s.title_bn, s.title_en, s.category_slug, s.area_bn, s.area_en))
                  .map((s) => (
                    <div key={s.id} className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">
                          {language === 'bn' ? s.title_bn : s.title_en}
                          {s.is_active === false && (
                            <span className="ml-2 px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">{t('admin.inactive')}</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          {t(`categories.${s.category_slug}`)} • {formatInr(s.base_price_inr, language)} • {toLocaleDigits(s.duration_minutes, language)} {t('home.min_short')}
                        </div>
                      </div>
                      <button type="button" onClick={() => startEditService(s)} className="px-3 py-1.5 rounded-xl border border-brand-blue text-brand-blue text-xs font-bold">
                        {t('admin.edit_btn')}
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {tab === 'reviews' && (
            <div className="bg-white rounded-2xl border p-6 space-y-3">
              {reviews.length === 0 ? (
                <p className="text-sm text-slate-500">{t('marketplace.no_reviews')}</p>
              ) : (
                reviews.map((r) => {
                  const visible = Boolean(r.is_visible);
                  return (
                    <div key={String(r.id)} className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm">
                          {String(r.customer_name)} • ★ {toLocaleDigits(String(r.rating), language)}/{toLocaleDigits(5, language)}
                        </div>
                        <div className="text-xs text-slate-600">{String(r.comment)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleReviewVisibility(String(r.id), visible)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold ${visible ? 'bg-emerald-100 text-brand-green' : 'bg-slate-200 text-slate-700'}`}
                      >
                        {visible ? t('admin.visible') : t('admin.hidden')} • {t('admin.toggle_visibility')}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === 'complaints' && (
            <div className="bg-white rounded-2xl border p-6 space-y-3">
              {complaints.filter((c) => matchesQuery(c.subject, c.message, c.email, c.status)).length === 0 ? (
                <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
              ) : (
                complaints
                  .filter((c) => matchesQuery(c.subject, c.message, c.email, c.status))
                  .map((c) => {
                    const cid = String(c.id);
                    return (
                      <div key={cid} className="p-4 rounded-xl border space-y-3">
                        <div className="flex flex-wrap justify-between items-start gap-2">
                          <div>
                            <div className="font-bold text-sm">{String(c.subject)}</div>
                            <div className="text-xs text-slate-500">{String(c.name || '')} {c.email ? `(${String(c.email)})` : ''}</div>
                            <div className="text-xs text-slate-700 mt-1">{String(c.message)}</div>
                          </div>
                          <select
                            value={complaintStatuses[cid] || String(c.status)}
                            onChange={(e) => setComplaintStatuses((prev) => ({ ...prev, [cid]: e.target.value }))}
                            className="border rounded-xl px-2.5 py-1.5 text-xs font-bold bg-white"
                          >
                            <option value="open">open</option>
                            <option value="in_review">in_review</option>
                            <option value="resolved">{t('admin.resolved')}</option>
                          </select>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            type="text"
                            value={complaintNotes[cid] || ''}
                            onChange={(e) => setComplaintNotes((prev) => ({ ...prev, [cid]: e.target.value }))}
                            placeholder={t('admin.note_placeholder')}
                            className="flex-1 min-w-[200px] border rounded-xl px-3 py-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateComplaint(cid)}
                            className="px-4 py-1.5 rounded-xl bg-brand-blue text-white text-xs font-bold"
                          >
                            {t('admin.save_complaint')}
                          </button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {tab === 'cms' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={handleSaveCms} className="bg-white rounded-2xl border p-6 space-y-3">
                <h2 className="font-bold">{t('admin.cms_title')}</h2>
                <input type="text" value={cmsKey} onChange={(e) => setCmsKey(e.target.value)} placeholder={t('admin.cms_key')} className="w-full border rounded-xl px-3 py-2 text-sm" required />
                <textarea value={cmsBn} onChange={(e) => setCmsBn(e.target.value)} rows={2} placeholder={t('admin.cms_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <textarea value={cmsEn} onChange={(e) => setCmsEn(e.target.value)} rows={2} placeholder={t('admin.cms_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-green text-white text-sm font-bold">{t('admin.save_cms')}</button>
              </form>

              <div className="bg-white rounded-2xl border p-6 space-y-3">
                {cmsEntries.map((item) => (
                  <div key={item.key} className="p-3 rounded-xl border space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-brand-blue">{item.key}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCmsKey(item.key);
                          setCmsBn(item.value_bn);
                          setCmsEn(item.value_en);
                        }}
                        className="text-xs font-bold text-brand-green hover:underline"
                      >
                        {t('admin.edit_btn')}
                      </button>
                    </div>
                    <div className="text-xs text-slate-700">{item.value_bn}</div>
                    <div className="text-xs text-slate-500">{item.value_en}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'broadcast' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <form onSubmit={handleSendBroadcast} className="bg-white rounded-2xl border p-6 space-y-3">
                <h2 className="font-bold text-slate-900">{t('admin.broadcast_title')}</h2>
                <input type="text" value={bcastTitleBn} onChange={(e) => setBcastTitleBn(e.target.value)} placeholder={t('admin.msg_title_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <input type="text" value={bcastTitleEn} onChange={(e) => setBcastTitleEn(e.target.value)} placeholder={t('admin.msg_title_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <textarea value={bcastBodyBn} onChange={(e) => setBcastBodyBn(e.target.value)} rows={2} placeholder={t('admin.msg_body_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <textarea value={bcastBodyEn} onChange={(e) => setBcastBodyEn(e.target.value)} rows={2} placeholder={t('admin.msg_body_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-bold">{t('admin.send_broadcast')}</button>
              </form>

              <div className="bg-white rounded-2xl border p-6 space-y-3">
                <h2 className="font-bold text-slate-900">{t('admin.recent_notifications')}</h2>
                {recentNotifications.length === 0 ? (
                  <p className="text-sm text-slate-500">{t('dashboard.no_notifications')}</p>
                ) : (
                  recentNotifications.slice(0, 20).map((n) => (
                    <div key={String(n.id)} className="p-3 rounded-xl border text-xs space-y-1">
                      <div className="font-bold flex justify-between gap-2">
                        <span>{language === 'bn' ? String(n.title_bn) : String(n.title_en)}</span>
                        <span className="text-slate-400">{String(n.user_email || '')}</span>
                      </div>
                      <div className="text-slate-600">{language === 'bn' ? String(n.body_bn) : String(n.body_en)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === 'audit' && (
            <div className="bg-white rounded-2xl border p-6 space-y-2 text-xs">
              {auditLogs.map((l) => (
                <div key={String(l.id)} className="p-2 border-b flex flex-wrap justify-between gap-2">
                  <span>{String(l.action)} ({String(l.target_type)})</span>
                  <span className="text-slate-500">{String(l.actor_email || 'system')}</span>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
