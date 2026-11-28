import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRequest, formatInr, toLocaleDigits } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS } from '../components/CategoryIcon';
import type { ServiceItem } from '../types';

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

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage } = useAuth();
  const [tab, setTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, unknown>>>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [reviews, setReviews] = useState<Array<Record<string, unknown>>>([]);
  const [complaints, setComplaints] = useState<Array<Record<string, unknown>>>([]);
  const [cmsEntries, setCmsEntries] = useState<Array<{ key: string; value_bn: string; value_en: string }>>([]);
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

  // Category upsert form
  const [catSlug, setCatSlug] = useState('');
  const [catNameBn, setCatNameBn] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catDescBn, setCatDescBn] = useState('');
  const [catDescEn, setCatDescEn] = useState('');

  // Broadcast form
  const [bcastTitleBn, setBcastTitleBn] = useState('');
  const [bcastTitleEn, setBcastTitleEn] = useState('');
  const [bcastBodyBn, setBcastBodyBn] = useState('');
  const [bcastBodyEn, setBcastBodyEn] = useState('');

  const loadAdminData = async () => {
    try {
      const [sRes, pRes, uRes, bRes, cRes, svcRes, rRes, compRes, cmsRes, aRes, hRes] = await Promise.all([
        apiRequest<{ stats: Record<string, number> }>('/admin/stats'),
        apiRequest<{ providers: Array<Record<string, unknown>> }>('/admin/providers'),
        apiRequest<{ users: Array<Record<string, unknown>> }>('/admin/users'),
        apiRequest<{ bookings: Array<Record<string, unknown>> }>('/admin/bookings'),
        apiRequest<{ categories: Array<Record<string, unknown>> }>('/admin/categories'),
        apiRequest<{ services: ServiceItem[] }>('/services'),
        apiRequest<{ reviews: Array<Record<string, unknown>> }>('/admin/reviews'),
        apiRequest<{ complaints: Array<Record<string, unknown>> }>('/admin/complaints'),
        apiRequest<{ content: Array<{ key: string; value_bn: string; value_en: string }> }>('/content'),
        apiRequest<{ logs: Array<Record<string, unknown>> }>('/admin/audit-logs'),
        apiRequest<Record<string, unknown>>('/health')
      ]);
      setStats(sRes.stats);
      setProviders(pRes.providers);
      setUsers(uRes.users);
      setBookings(bRes.bookings);
      setCategories(cRes.categories);
      setServices(svcRes.services);
      setReviews(rRes.reviews);
      setComplaints(compRes.complaints);
      setCmsEntries(cmsRes.content);
      setAuditLogs(aRes.logs);
      setHealth(hRes);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') loadAdminData();
  }, [user]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

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
          descriptionEn: catDescEn
        })
      });
      setCatSlug('');
      setCatNameBn('');
      setCatNameEn('');
      setCatDescBn('');
      setCatDescEn('');
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
  };

  const startEditService = (svc: ServiceItem) => {
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
          isActive: true
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
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const tabs: AdminTab[] = [
    'stats',
    'providers',
    'users',
    'bookings',
    'categories',
    'services',
    'reviews',
    'complaints',
    'cms',
    'broadcast',
    'audit'
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('dashboard.admin_title')}</h1>
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
          <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-brand-green text-xs font-bold">
            {t('admin.api_status')}: {String(health.status || 'ok')} • {t('admin.db_status')}: {String(health.database || 'connected')}
          </span>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold">{msg}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{error}</div>}

      <div className="flex flex-wrap gap-2">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${tab === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
          >
            {t(`admin.tabs.${k}`)}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl border p-5">
              <div className="text-xs text-slate-500 font-semibold">{t(`admin.stats.${k}`, k)}</div>
              <div className="text-3xl font-extrabold text-brand-blue mt-1">{toLocaleDigits(v, language)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'providers' && (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          {providers.length === 0 ? (
            <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
          ) : (
            providers.map((p) => (
              <div key={String(p.id)} className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold">{String(p.full_name)} ({String(p.email)})</div>
                  <div className="text-xs text-slate-500">
                    {t('admin.status')}: {String(p.approval_status)} • {language === 'bn' ? String(p.service_location_bn || '') : String(p.service_location_en || '')}
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
        <div className="bg-white rounded-2xl border p-6 space-y-2">
          {users.map((u) => (
            <div key={String(u.id)} className="p-3 border-b text-sm flex flex-wrap justify-between gap-2">
              <span>{String(u.full_name)} — {String(u.email)} ({toLocaleDigits(String(u.mobile_number || ''), language)})</span>
              <span className="font-bold text-xs uppercase text-brand-blue">{String(u.role)} ({String(u.language_preference)})</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="bg-white rounded-2xl border p-6 space-y-2">
          {bookings.length === 0 ? (
            <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
          ) : (
            bookings.map((b) => (
              <div key={String(b.id)} className="p-3 border-b text-sm flex flex-wrap justify-between gap-2">
                <span>
                  {language === 'bn' ? String(b.service_title_bn) : String(b.service_title_en)} — {String(b.customer_name)} ({formatInr(Number(b.amount_inr || 0), language)})
                </span>
                <span className="font-bold text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-blue">
                  {t(`booking.${String(b.status)}`, String(b.status))}
                </span>
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
            <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-green text-white text-sm font-bold">{t('admin.save_category')}</button>
          </form>
          <div className="lg:col-span-2 bg-white rounded-2xl border p-6 grid grid-cols-1 md:grid-cols-2 gap-3 content-start">
            {categories.map((c) => (
              <div key={String(c.id)} className="p-3 rounded-xl border">
                <div className="font-bold">{String(c.name_bn)} / {String(c.name_en)}</div>
                <div className="text-xs text-slate-500">{String(c.slug)}</div>
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
            <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold">{t('admin.save_service')}</button>
          </form>

          <div className="lg:col-span-2 bg-white rounded-2xl border p-6 space-y-3">
            {services.map((s) => (
              <div key={s.id} className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sm">{language === 'bn' ? s.title_bn : s.title_en}</div>
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
          {complaints.length === 0 ? (
            <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
          ) : (
            complaints.map((c) => (
              <div key={String(c.id)} className="p-3 rounded-xl border flex flex-wrap justify-between items-center gap-3">
                <div>
                  <div className="font-bold text-sm">{String(c.subject)}</div>
                  <div className="text-xs text-slate-600">{String(c.message)}</div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    apiRequest(`/admin/complaints/${c.id}`, {
                      method: 'PATCH',
                      body: JSON.stringify({ status: 'resolved', adminNote: 'Resolved' })
                    })
                      .then(loadAdminData)
                      .catch((err) => setError((err as Error).message))
                  }
                  className="px-3 py-1.5 rounded-xl bg-brand-blue text-white text-xs font-bold"
                >
                  {String(c.status) === 'resolved' ? t('admin.resolved') : t('admin.resolve')}
                </button>
              </div>
            ))
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
        <form onSubmit={handleSendBroadcast} className="bg-white rounded-2xl border p-6 space-y-3 max-w-xl">
          <h2 className="font-bold text-slate-900">{t('admin.broadcast_title')}</h2>
          <input type="text" value={bcastTitleBn} onChange={(e) => setBcastTitleBn(e.target.value)} placeholder={t('admin.msg_title_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <input type="text" value={bcastTitleEn} onChange={(e) => setBcastTitleEn(e.target.value)} placeholder={t('admin.msg_title_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <textarea value={bcastBodyBn} onChange={(e) => setBcastBodyBn(e.target.value)} rows={2} placeholder={t('admin.msg_body_bn')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <textarea value={bcastBodyEn} onChange={(e) => setBcastBodyEn(e.target.value)} rows={2} placeholder={t('admin.msg_body_en')} required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-orange text-white text-sm font-bold">{t('admin.send_broadcast')}</button>
        </form>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border p-6 space-y-2 text-xs">
          {auditLogs.map((l) => (
            <div key={String(l.id)} className="p-2 border-b flex justify-between">
              <span>{String(l.action)} ({String(l.target_type)})</span>
              <span className="text-slate-500">{String(l.actor_email || 'system')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
