import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, MapPin, Star, Trash2 } from 'lucide-react';
import { apiRequest, formatInr } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { BookingItem, NotificationItem, UserAddress } from '../types';

export const CustomerDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage, refreshUser } = useAuth();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobile_number || '');
  const [fullAddress, setFullAddress] = useState(user?.full_address || '');
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrLine, setNewAddrLine] = useState('');
  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [msg, setMsg] = useState('');

  const loadAll = async () => {
    try {
      const [meRes, bRes, nRes] = await Promise.all([
        apiRequest<{ addresses: UserAddress[] }>('/users/me'),
        apiRequest<{ bookings: BookingItem[] }>('/bookings/me'),
        apiRequest<{ notifications: NotificationItem[] }>('/users/notifications')
      ]);
      setAddresses(meRes.addresses);
      setBookings(bRes.bookings);
      setNotifications(nRes.notifications);
    } catch {
      // Handled by empty state
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setMobileNumber(user.mobile_number);
      setFullAddress(user.full_address);
      loadAll();
    }
  }, [user]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ fullName, mobileNumber, fullAddress })
    });
    await refreshUser();
    setMsg(language === 'bn' ? 'প্রোফাইল সংরক্ষিত হয়েছে' : 'Profile updated');
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiRequest('/users/me/addresses', {
      method: 'POST',
      body: JSON.stringify({ label: newAddrLabel, addressLine: newAddrLine })
    });
    setNewAddrLabel('');
    setNewAddrLine('');
    loadAll();
  };

  const handleCancelBooking = async (id: string) => {
    await apiRequest(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' })
    });
    loadAll();
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTargetId) return;
    await apiRequest('/reviews', {
      method: 'POST',
      body: JSON.stringify({ bookingId: reviewTargetId, rating: reviewRating, comment: reviewComment })
    });
    setReviewTargetId(null);
    setReviewComment('');
    loadAll();
  };

  const handleMarkRead = async (id: string) => {
    await apiRequest(`/users/notifications/${id}/read`, { method: 'PATCH' });
    loadAll();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('dashboard.customer_title')}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => switchLanguage('bn')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${language === 'bn' ? 'bg-brand-green text-white' : 'bg-white'}`}
          >
            বাংলা
          </button>
          <button
            type="button"
            onClick={() => switchLanguage('en')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${language === 'en' ? 'bg-brand-blue text-white' : 'bg-white'}`}
          >
            English
          </button>
        </div>
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold">{msg}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile & Saved Addresses */}
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.profile')}</h2>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required />
            <input type="text" value={user.email} disabled className="w-full border rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-500" />
            <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-sm" required />
            <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" required />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold">
              {t('dashboard.save_changes')}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-green" />
              <span>Saved Addresses</span>
            </h3>
            {addresses.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 text-xs p-2.5 bg-slate-50 rounded-xl">
                <div>
                  <div className="font-bold">{a.label}</div>
                  <div className="text-slate-600">{a.address_line}</div>
                </div>
                <button type="button" onClick={() => apiRequest(`/users/me/addresses/${a.id}`, { method: 'DELETE' }).then(loadAll)} className="text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <form onSubmit={handleAddAddress} className="space-y-2 pt-2">
              <input type="text" value={newAddrLabel} onChange={(e) => setNewAddrLabel(e.target.value)} placeholder="Home / Office" required className="w-full border rounded-xl px-3 py-2 text-xs" />
              <input type="text" value={newAddrLine} onChange={(e) => setNewAddrLine(e.target.value)} placeholder={t('auth.address')} required className="w-full border rounded-xl px-3 py-2 text-xs" />
              <button type="submit" className="w-full py-2 rounded-xl border border-brand-green text-brand-green text-xs font-bold">+ Add Address</button>
            </form>
          </div>
        </div>

        {/* Bookings & Notifications */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">{t('dashboard.bookings')}</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => (
                  <div key={b.id} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-slate-900">
                        {language === 'bn' ? b.service_title_bn : b.service_title_en}
                      </div>
                      <span className="px-3 py-1 rounded-full bg-blue-50 text-brand-blue text-xs font-bold">
                        {t(`booking.${b.status}`)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600">
                      {b.preferred_date} • {b.preferred_time} • {formatInr(b.amount_inr, language)}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {(b.status === 'pending' || b.status === 'accepted') && (
                        <button
                          type="button"
                          onClick={() => handleCancelBooking(b.id)}
                          className="px-3 py-1.5 rounded-xl bg-red-50 text-red-700 text-xs font-bold"
                        >
                          {t('booking.cancel')}
                        </button>
                      )}
                      {b.status === 'completed' && !b.has_review && (
                        <button
                          type="button"
                          onClick={() => setReviewTargetId(b.id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>{t('booking.leave_review')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {reviewTargetId && (
              <form onSubmit={handleSubmitReview} className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="font-bold text-sm">{t('booking.leave_review')}</div>
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="border rounded-xl px-3 py-2 text-sm">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{n} ★</option>
                  ))}
                </select>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder="Feedback..." />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-xl bg-brand-green text-white text-xs font-bold">Submit</button>
                  <button type="button" onClick={() => setReviewTargetId(null)} className="px-4 py-2 rounded-xl border text-xs font-bold">Close</button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-orange" />
              <span>{t('dashboard.notifications')}</span>
            </h2>
            {notifications.map((n) => (
              <div key={n.id} className={`p-3 rounded-xl border ${n.is_read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/50 border-blue-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-bold text-sm">{language === 'bn' ? n.title_bn : n.title_en}</div>
                  {!n.is_read && (
                    <button type="button" onClick={() => handleMarkRead(n.id)} className="text-xs text-brand-blue font-bold">
                      Mark read
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 mt-1">{language === 'bn' ? n.body_bn : n.body_en}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
