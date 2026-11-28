import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiRequest, formatInr, toLocaleDigits } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS } from '../components/CategoryIcon';
import type { BookingItem, WorkerProfile } from '../types';

export const ProviderDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; customer_name: string }>>([]);

  const [bioBn, setBioBn] = useState('');
  const [bioEn, setBioEn] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [locationBn, setLocationBn] = useState('কলকাতা');
  const [locationEn, setLocationEn] = useState('Kolkata');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['electrician']);
  const [experienceYears, setExperienceYears] = useState(2);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [meRes, bRes] = await Promise.all([
        apiRequest<{ profile: WorkerProfile | null; reviews: Array<{ id: string; rating: number; comment: string; customer_name: string }> }>('/provider/me'),
        apiRequest<{ bookings: BookingItem[] }>('/bookings/provider').catch(() => ({ bookings: [] }))
      ]);
      setProfile(meRes.profile);
      setReviews(meRes.reviews);
      setBookings(bRes.bookings);
      if (meRes.profile) {
        setBioBn(meRes.profile.bio_bn);
        setBioEn(meRes.profile.bio_en);
        setPhotoUrl(meRes.profile.photo_url);
        setLocationBn(meRes.profile.service_location_bn);
        setLocationEn(meRes.profile.service_location_en);
        setSelectedCategories(meRes.profile.service_categories.length ? meRes.profile.service_categories : ['electrician']);
        setExperienceYears(meRes.profile.experience_years);
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;

  const toggleCat = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? (prev.length > 1 ? prev.filter((c) => c !== slug) : prev) : [...prev, slug]
    );
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await apiRequest('/provider/apply', {
        method: 'POST',
        body: JSON.stringify({
          bioBn,
          bioEn,
          photoUrl,
          serviceCategories: selectedCategories,
          serviceLocationBn: locationBn,
          serviceLocationEn: locationEn,
          experienceYears,
          isAvailable: profile?.is_available ?? true
        })
      });
      setMsg(t('provider.profile_saved'));
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleAvailability = async () => {
    if (!profile) return;
    setError('');
    try {
      await apiRequest('/provider/me/availability', {
        method: 'PATCH',
        body: JSON.stringify({ isAvailable: !profile.is_available })
      });
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleBookingAction = async (bookingId: string, status: string) => {
    setError('');
    try {
      await apiRequest(`/bookings/${bookingId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('dashboard.provider_title')}</h1>
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
          {profile && (
            <button
              type="button"
              onClick={handleToggleAvailability}
              className={`px-4 py-2 rounded-xl text-sm font-bold ${profile.is_available ? 'bg-brand-green text-white' : 'bg-slate-200 text-slate-700'}`}
            >
              {t('dashboard.available_toggle')}: {profile.is_available ? t('provider.on') : t('provider.off')}
            </button>
          )}
        </div>
      </div>

      {/* Admin Approval Status Banner */}
      {!profile?.is_approved ? (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-sm font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0 text-brand-orange" />
          <span>{t('dashboard.approval_pending')}</span>
        </div>
      ) : (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-brand-green text-sm font-semibold">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{t('dashboard.approval_approved')}</span>
        </div>
      )}

      {msg && <div className="p-3 rounded-xl bg-blue-50 text-brand-blue text-sm font-semibold">{msg}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSaveProvider} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            {photoUrl ? (
              <img src={photoUrl} alt={user.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-brand-blue text-white font-bold flex items-center justify-center">
                {user.full_name.charAt(0)}
              </div>
            )}
            <h2 className="text-lg font-bold">{t('provider.profile_title')}</h2>
          </div>
          <input type="text" value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder={t('provider.photo_url')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <input type="text" value={locationBn} onChange={(e) => setLocationBn(e.target.value)} placeholder={t('provider.location_bn')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <input type="text" value={locationEn} onChange={(e) => setLocationEn(e.target.value)} placeholder={t('provider.location_en')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('provider.experience_years')}</label>
            <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} placeholder={t('provider.experience_years')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          </div>
          <textarea value={bioBn} onChange={(e) => setBioBn(e.target.value)} rows={2} placeholder={t('provider.bio_bn')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <textarea value={bioEn} onChange={(e) => setBioEn(e.target.value)} rows={2} placeholder={t('provider.bio_en')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" />
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-2">{t('provider.categories_label')}</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_SLUGS.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleCat(slug)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${selectedCategories.includes(slug) ? 'bg-brand-blue text-white border-brand-blue' : 'bg-slate-50 border-slate-200'}`}
                >
                  {t(`categories.${slug}`)}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-green text-white font-bold text-sm hover:bg-emerald-800">
            {t('dashboard.save_changes')}
          </button>
        </form>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-xl font-bold">{t('provider.booking_requests')}</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{language === 'bn' ? b.service_title_bn : b.service_title_en}</span>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100">{t(`booking.${b.status}`)}</span>
                  </div>
                  <div className="text-xs text-slate-600">
                    {b.customer_name} • {toLocaleDigits(b.customer_phone, language)} • {b.service_address} • {formatInr(b.amount_inr, language)}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {b.status === 'pending' && (
                      <>
                        <button type="button" onClick={() => handleBookingAction(b.id, 'accepted')} className="px-3 py-1.5 rounded-xl bg-brand-green text-white text-xs font-bold">{t('booking.accept')}</button>
                        <button type="button" onClick={() => handleBookingAction(b.id, 'rejected')} className="px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold">{t('booking.reject')}</button>
                      </>
                    )}
                    {b.status === 'accepted' && (
                      <button type="button" onClick={() => handleBookingAction(b.id, 'in_progress')} className="px-3 py-1.5 rounded-xl bg-brand-blue text-white text-xs font-bold">{t('booking.start')}</button>
                    )}
                    {b.status === 'in_progress' && (
                      <button type="button" onClick={() => handleBookingAction(b.id, 'completed')} className="px-3 py-1.5 rounded-xl bg-brand-orange text-white text-xs font-bold">{t('booking.complete')}</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="text-xl font-bold">
              {t('provider.customer_reviews')} ({toLocaleDigits(reviews.length, language)})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">{t('marketplace.no_reviews')}</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="p-3 rounded-xl bg-slate-50 text-sm">
                  <div className="font-bold flex justify-between">
                    <span>{r.customer_name}</span>
                    <span className="text-amber-600">★ {toLocaleDigits(r.rating, language)}/{toLocaleDigits(5, language)}</span>
                  </div>
                  <p className="text-slate-600 text-xs mt-1">{r.comment}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
