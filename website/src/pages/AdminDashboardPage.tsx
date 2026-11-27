import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const [tab, setTab] = useState<'stats' | 'providers' | 'users' | 'bookings' | 'categories' | 'complaints' | 'cms' | 'audit'>('stats');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [providers, setProviders] = useState<Array<Record<string, unknown>>>([]);
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [bookings, setBookings] = useState<Array<Record<string, unknown>>>([]);
  const [categories, setCategories] = useState<Array<Record<string, unknown>>>([]);
  const [complaints, setComplaints] = useState<Array<Record<string, unknown>>>([]);
  const [auditLogs, setAuditLogs] = useState<Array<Record<string, unknown>>>([]);
  const [health, setHealth] = useState<Record<string, unknown>>({});

  const [cmsKey, setCmsKey] = useState('hero_headline');
  const [cmsBn, setCmsBn] = useState('');
  const [cmsEn, setCmsEn] = useState('');

  const loadAdminData = async () => {
    try {
      const [sRes, pRes, uRes, bRes, cRes, compRes, aRes, hRes] = await Promise.all([
        apiRequest<{ stats: Record<string, number> }>('/admin/stats'),
        apiRequest<{ providers: Array<Record<string, unknown>> }>('/admin/providers'),
        apiRequest<{ users: Array<Record<string, unknown>> }>('/admin/users'),
        apiRequest<{ bookings: Array<Record<string, unknown>> }>('/admin/bookings'),
        apiRequest<{ categories: Array<Record<string, unknown>> }>('/admin/categories'),
        apiRequest<{ complaints: Array<Record<string, unknown>> }>('/admin/complaints'),
        apiRequest<{ logs: Array<Record<string, unknown>> }>('/admin/audit-logs'),
        apiRequest<Record<string, unknown>>('/health')
      ]);
      setStats(sRes.stats);
      setProviders(pRes.providers);
      setUsers(uRes.users);
      setBookings(bRes.bookings);
      setCategories(cRes.categories);
      setComplaints(compRes.complaints);
      setAuditLogs(aRes.logs);
      setHealth(hRes);
    } catch {
      // Handled by RBAC
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') loadAdminData();
  }, [user]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/" replace />;

  const handleApproveProvider = async (id: string, decision: 'approved' | 'rejected') => {
    await apiRequest(`/admin/providers/${id}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ decision })
    });
    loadAdminData();
  };

  const handleSaveCms = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/admin/content', {
      method: 'PUT',
      body: JSON.stringify({ key: cmsKey, valueBn: cmsBn, valueEn: cmsEn })
    });
    setCmsBn('');
    setCmsEn('');
    loadAdminData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('dashboard.admin_title')}</h1>
        <span className="px-3 py-1 rounded-full bg-emerald-100 text-brand-green text-xs font-bold">
          API: {String(health.status || 'ok')} • DB: {String(health.database || 'connected')}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['stats', 'providers', 'users', 'bookings', 'categories', 'complaints', 'cms', 'audit'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize border ${tab === k ? 'bg-slate-900 text-white' : 'bg-white'}`}
          >
            {k}
          </button>
        ))}
      </div>

      {tab === 'stats' && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-white rounded-2xl border p-5">
              <div className="text-xs text-slate-500 uppercase">{k}</div>
              <div className="text-3xl font-extrabold text-brand-blue mt-1">{v}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'providers' && (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          {providers.map((p) => (
            <div key={String(p.id)} className="p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">{String(p.full_name)} ({String(p.email)})</div>
                <div className="text-xs text-slate-500">Status: {String(p.approval_status)}</div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleApproveProvider(String(p.id), 'approved')} className="px-3 py-1.5 rounded-xl bg-brand-green text-white text-xs font-bold">Approve</button>
                <button type="button" onClick={() => handleApproveProvider(String(p.id), 'rejected')} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white rounded-2xl border p-6 space-y-2">
          {users.map((u) => (
            <div key={String(u.id)} className="p-3 border-b text-sm flex justify-between">
              <span>{String(u.full_name)} — {String(u.email)}</span>
              <span className="font-bold text-xs uppercase">{String(u.role)} ({String(u.language_preference)})</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'bookings' && (
        <div className="bg-white rounded-2xl border p-6 space-y-2">
          {bookings.map((b) => (
            <div key={String(b.id)} className="p-3 border-b text-sm flex justify-between">
              <span>{String(b.service_title_en)} — {String(b.customer_name)}</span>
              <span className="font-bold text-xs uppercase">{String(b.status)}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'categories' && (
        <div className="bg-white rounded-2xl border p-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          {categories.map((c) => (
            <div key={String(c.id)} className="p-3 rounded-xl border">
              <div className="font-bold">{String(c.name_bn)} / {String(c.name_en)}</div>
              <div className="text-xs text-slate-500">{String(c.slug)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'complaints' && (
        <div className="bg-white rounded-2xl border p-6 space-y-3">
          {complaints.map((c) => (
            <div key={String(c.id)} className="p-3 rounded-xl border flex justify-between items-center">
              <div>
                <div className="font-bold text-sm">{String(c.subject)}</div>
                <div className="text-xs text-slate-600">{String(c.message)}</div>
              </div>
              <button
                type="button"
                onClick={() => apiRequest(`/admin/complaints/${c.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved', adminNote: 'Resolved' }) }).then(loadAdminData)}
                className="px-3 py-1.5 rounded-xl bg-brand-blue text-white text-xs font-bold"
              >
                {String(c.status)}
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === 'cms' && (
        <form onSubmit={handleSaveCms} className="bg-white rounded-2xl border p-6 space-y-3 max-w-xl">
          <h2 className="font-bold">Bilingual Website Content CMS</h2>
          <input type="text" value={cmsKey} onChange={(e) => setCmsKey(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required />
          <textarea value={cmsBn} onChange={(e) => setCmsBn(e.target.value)} rows={2} placeholder="Bengali content" required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <textarea value={cmsEn} onChange={(e) => setCmsEn(e.target.value)} rows={2} placeholder="English content" required className="w-full border rounded-xl px-3 py-2 text-sm" />
          <button type="submit" className="px-5 py-2.5 rounded-xl bg-brand-green text-white text-sm font-bold">Save CMS Entry</button>
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
