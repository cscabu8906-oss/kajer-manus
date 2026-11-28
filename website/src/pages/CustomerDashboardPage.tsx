import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Bell, Camera, CreditCard, Heart, MapPin, Settings, Star, Trash2 } from 'lucide-react';
import { apiRequest, formatInr, providerSearchApi, resolveMediaUrl, toLocaleDigits, uploadImages } from '../lib/api';
import { startRazorpayCheckout } from '../lib/razorpay';
import { useAuth } from '../context/AuthContext';
import { EMPTY_WB_LOCATION, LocationCascadingSelect } from '../components/LocationCascadingSelect';
import type { BookingItem, NotificationItem, SelectedWbLocation, User, UserAddress, WorkerProfile } from '../types';

export const CustomerDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage, refreshUser } = useAuth();
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [favourites, setFavourites] = useState<WorkerProfile[]>([]);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [mobileNumber, setMobileNumber] = useState(user?.mobile_number || '');
  const [fullAddress, setFullAddress] = useState(user?.full_address || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(user?.profile_photo_url || '');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileWbLoc, setProfileWbLoc] = useState<SelectedWbLocation>(EMPTY_WB_LOCATION);

  const [pushEnabled, setPushEnabled] = useState(user?.push_notifications_enabled ?? true);
  const [emailEnabled, setEmailEnabled] = useState(user?.email_notifications_enabled ?? true);
  const [bengaliNumerals, setBengaliNumerals] = useState(user?.bengali_numerals ?? true);

  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrLine, setNewAddrLine] = useState('');
  const [newAddrWbLoc, setNewAddrWbLoc] = useState<SelectedWbLocation>(EMPTY_WB_LOCATION);

  const [reviewTargetId, setReviewTargetId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadAll = async () => {
    try {
      const [meRes, bRes, nRes] = await Promise.all([
        apiRequest<{ addresses: UserAddress[]; favourites?: WorkerProfile[] }>('/users/me'),
        apiRequest<{ bookings: BookingItem[] }>('/bookings/me'),
        apiRequest<{ notifications: NotificationItem[] }>('/users/notifications')
      ]);
      setAddresses(meRes.addresses);
      setFavourites(meRes.favourites || []);
      setBookings(bRes.bookings);
      setNotifications(nRes.notifications);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setMobileNumber(user.mobile_number);
      setFullAddress(user.full_address);
      setProfilePhotoUrl(user.profile_photo_url || '');
      setProfileWbLoc({
        stateName: 'West Bengal',
        districtId: user.district_id || '',
        subdivisionId: user.subdivision_id || '',
        areaType: user.area_type || '',
        localBodyId: user.local_body_id || '',
        gpWardId: user.gp_ward_id || '',
        villageId: user.village_id || '',
        villageLocality: user.village_locality || '',
        pincode: user.pincode || '',
        latitude: user.latitude ?? null,
        longitude: user.longitude ?? null,
        gpsConsent: Boolean(user.location_consent)
      });
      setPushEnabled(user.push_notifications_enabled);
      setEmailEnabled(user.email_notifications_enabled);
      setBengaliNumerals(user.bengali_numerals);
      loadAll();
    }
  }, [user]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;

  const handleProfilePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setPhotoUploading(true);
    try {
      const urls = await uploadImages([file], 'avatars');
      if (urls[0]) setProfilePhotoUrl(urls[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await apiRequest('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          mobileNumber,
          fullAddress,
          profilePhotoUrl,
          districtId: profileWbLoc.districtId || null,
          subdivisionId: profileWbLoc.subdivisionId || null,
          areaType: profileWbLoc.areaType || '',
          localBodyId: profileWbLoc.localBodyId || null,
          gpWardId: profileWbLoc.gpWardId || null,
          villageId: profileWbLoc.villageId || null,
          villageLocality: profileWbLoc.villageLocality || '',
          pincode: profileWbLoc.pincode || '',
          latitude: profileWbLoc.latitude,
          longitude: profileWbLoc.longitude,
          locationConsent: profileWbLoc.gpsConsent,
          pushNotificationsEnabled: pushEnabled,
          emailNotificationsEnabled: emailEnabled
        })
      });
      await refreshUser();
      setMsg(t('dashboard.profile_updated'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTogglePreference = async (nextPush: boolean, nextEmail: boolean) => {
    setPushEnabled(nextPush);
    setEmailEnabled(nextEmail);
    setMsg('');
    setError('');
    try {
      await apiRequest<{ user: User }>('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName,
          mobileNumber,
          fullAddress,
          pushNotificationsEnabled: nextPush,
          emailNotificationsEnabled: nextEmail
        })
      });
      await refreshUser();
      setMsg(t('dashboard.profile_updated'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleToggleNumerals = async (nextVal: boolean) => {
    setBengaliNumerals(nextVal);
    setError('');
    try {
      await apiRequest('/users/me/language', {
        method: 'PATCH',
        body: JSON.stringify({ languagePreference: language, bengaliNumerals: nextVal })
      });
      await refreshUser();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/users/me/addresses', {
        method: 'POST',
        body: JSON.stringify({
          label: newAddrLabel,
          addressLine: newAddrLine,
          districtId: newAddrWbLoc.districtId || null,
          subdivisionId: newAddrWbLoc.subdivisionId || null,
          areaType: newAddrWbLoc.areaType || '',
          localBodyId: newAddrWbLoc.localBodyId || null,
          gpWardId: newAddrWbLoc.gpWardId || null,
          villageId: newAddrWbLoc.villageId || null,
          villageLocality: newAddrWbLoc.villageLocality || '',
          pincode: newAddrWbLoc.pincode || '',
          latitude: newAddrWbLoc.latitude,
          longitude: newAddrWbLoc.longitude
        })
      });
      setNewAddrLabel('');
      setNewAddrLine('');
      setNewAddrWbLoc(EMPTY_WB_LOCATION);
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/users/me/addresses/${id}`, { method: 'DELETE' });
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveFavourite = async (providerUserId: string) => {
    setError('');
    try {
      await providerSearchApi.toggleFavourite(providerUserId, false);
      setFavourites((prev) => prev.filter((f) => f.user_id !== providerUserId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleCancelBooking = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/bookings/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTargetId) return;
    setError('');
    try {
      await apiRequest('/reviews', {
        method: 'POST',
        body: JSON.stringify({ bookingId: reviewTargetId, rating: reviewRating, comment: reviewComment })
      });
      setReviewTargetId(null);
      setReviewComment('');
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleMarkRead = async (id: string) => {
    setError('');
    try {
      await apiRequest(`/users/notifications/${id}/read`, { method: 'PATCH' });
      loadAll();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handlePayNow = async (bookingId: string) => {
    setMsg('');
    setError('');
    setPayingBookingId(bookingId);
    await startRazorpayCheckout({
      bookingId,
      onSuccess: (paymentId) => {
        setPayingBookingId(null);
        setMsg(`${t('booking.payment_success')} (${paymentId})`);
        loadAll();
      },
      onError: (errMsg) => {
        setPayingBookingId(null);
        setError(errMsg);
      },
      onDismiss: () => {
        setPayingBookingId(null);
      }
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {profilePhotoUrl ? (
            <img src={resolveMediaUrl(profilePhotoUrl)} alt={user.full_name} className="w-12 h-12 rounded-2xl object-cover border border-slate-200" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-brand-blue text-white font-extrabold flex items-center justify-center text-lg">
              {user.full_name.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('dashboard.customer_title')}</h1>
        </div>
        <div className="flex gap-2">
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
      </div>

      {msg && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold">{msg}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile, Preferences & Saved Addresses */}
        <div className="space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">{t('dashboard.profile')}</h2>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue cursor-pointer hover:underline">
                <Camera className="w-3.5 h-3.5" />
                <span>{photoUploading ? t('extra.uploading') : t('extra.upload_photo')}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleProfilePhotoUpload} className="hidden" />
              </label>
            </div>
            <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('auth.full_name')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" required />
            <input type="text" value={user.email} disabled className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-slate-50 text-slate-500" />
            <input type="tel" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} placeholder={t('auth.mobile')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" required />
            <LocationCascadingSelect value={profileWbLoc} onChange={(next) => setProfileWbLoc(next)} compact />
            <textarea value={fullAddress} onChange={(e) => setFullAddress(e.target.value)} rows={2} placeholder={t('auth.address')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm" required />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-brand-blue text-white text-sm font-bold hover:bg-blue-800">
              {t('dashboard.save_changes')}
            </button>
          </form>

          {/* Notification & Display Preferences */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Settings className="w-4 h-4 text-brand-blue" />
              <span>{t('dashboard.preferences_title')}</span>
            </h3>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-700 cursor-pointer">
              <span>{t('dashboard.push_notifications')}</span>
              <input
                type="checkbox"
                checked={pushEnabled}
                onChange={(e) => handleTogglePreference(e.target.checked, emailEnabled)}
                className="w-4 h-4 accent-brand-green"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-700 cursor-pointer">
              <span>{t('dashboard.email_notifications')}</span>
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => handleTogglePreference(pushEnabled, e.target.checked)}
                className="w-4 h-4 accent-brand-green"
              />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm text-slate-700 cursor-pointer">
              <span>{t('dashboard.bengali_numerals')}</span>
              <input
                type="checkbox"
                checked={bengaliNumerals}
                onChange={(e) => handleToggleNumerals(e.target.checked)}
                className="w-4 h-4 accent-brand-blue"
              />
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-brand-green" />
              <span>{t('dashboard.saved_addresses')}</span>
            </h3>
            {addresses.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-2 text-xs p-2.5 bg-slate-50 rounded-xl">
                <div>
                  <div className="font-bold">{a.label} {a.pincode ? `(${a.pincode})` : ''}</div>
                  <div className="text-slate-600">{a.address_line}</div>
                  {(a.district_name_en || a.local_body_name_en) && (
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {language === 'bn'
                        ? [a.gp_ward_name_bn, a.local_body_name_bn, a.district_name_bn].filter(Boolean).join(', ')
                        : [a.gp_ward_name_en, a.local_body_name_en, a.district_name_en].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAddress(a.id)}
                  className="text-red-500 p-1"
                  aria-label="Delete address"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <form onSubmit={handleAddAddress} className="space-y-2 pt-2 border-t border-slate-100">
              <input type="text" value={newAddrLabel} onChange={(e) => setNewAddrLabel(e.target.value)} placeholder={t('dashboard.address_label_placeholder')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
              <LocationCascadingSelect value={newAddrWbLoc} onChange={(next) => setNewAddrWbLoc(next)} compact showGpsDetect={false} />
              <input type="text" value={newAddrLine} onChange={(e) => setNewAddrLine(e.target.value)} placeholder={t('auth.address')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
              <button type="submit" className="w-full py-2 rounded-xl border border-brand-green text-brand-green text-xs font-bold hover:bg-emerald-50">
                {t('dashboard.add_address')}
              </button>
            </form>
          </div>
        </div>

        {/* Bookings, Favourite Providers & Notifications */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-xl font-bold text-slate-900">{t('dashboard.bookings')}</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
            ) : (
              <div className="space-y-3">
                {bookings.map((b) => {
                  const pStatus = b.payment_status || 'unpaid';
                  const pMethod = b.payment_method || 'cash';
                  const pBadgeClass =
                    pStatus === 'paid'
                      ? 'bg-emerald-100 text-brand-green'
                      : pStatus === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : pStatus === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : pStatus === 'refunded'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-700';
                  const canPayOnline =
                    pStatus !== 'paid' &&
                    pStatus !== 'refunded' &&
                    b.status !== 'cancelled' &&
                    b.status !== 'rejected';
                  return (
                    <div key={b.id} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-bold text-slate-900">
                          {language === 'bn' ? b.service_title_bn : b.service_title_en}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${pBadgeClass}`}>
                            {t(`booking.payment_status_${pStatus}`)}
                          </span>
                          <span className="px-3 py-1 rounded-full bg-blue-50 text-brand-blue text-xs font-bold">
                            {t(`booking.${b.status}`)}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                        <span>
                          {toLocaleDigits(b.preferred_date, language)} • {toLocaleDigits(b.preferred_time, language)} • {formatInr(b.amount_inr, language)}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                          {pMethod === 'razorpay' ? t('booking.method_razorpay') : t('booking.method_cash')}
                        </span>
                        {b.razorpay_payment_id && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            {b.razorpay_payment_id}
                          </span>
                        )}
                      </div>
                      {Array.isArray(b.problem_photos) && b.problem_photos.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {b.problem_photos.map((url, idx) => (
                            <img key={`${url}-${idx}`} src={resolveMediaUrl(url)} alt="Booking" className="w-12 h-12 rounded-lg object-cover border border-slate-200" />
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {canPayOnline && (
                          <button
                            type="button"
                            disabled={payingBookingId === b.id}
                            onClick={() => handlePayNow(b.id)}
                            className="px-3.5 py-1.5 rounded-xl bg-brand-blue hover:bg-blue-800 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>{payingBookingId === b.id ? t('home.loading') : t('booking.pay_now')}</span>
                          </button>
                        )}
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
                  );
                })}
              </div>
            )}

            {reviewTargetId && (
              <form onSubmit={handleSubmitReview} className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="font-bold text-sm">{t('booking.leave_review')}</div>
                <select value={reviewRating} onChange={(e) => setReviewRating(Number(e.target.value))} className="border rounded-xl px-3 py-2 text-sm bg-white">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>{toLocaleDigits(n, language)} ★</option>
                  ))}
                </select>
                <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} rows={2} className="w-full border rounded-xl px-3 py-2 text-sm" placeholder={t('dashboard.feedback_placeholder')} />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 rounded-xl bg-brand-green text-white text-xs font-bold">{t('dashboard.submit')}</button>
                  <button type="button" onClick={() => setReviewTargetId(null)} className="px-4 py-2 rounded-xl border text-xs font-bold bg-white">{t('dashboard.close')}</button>
                </div>
              </form>
            )}
          </div>

          {/* Favourite Providers */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500" />
              <span>{t('extra.my_favourites')}</span>
            </h2>
            {favourites.length === 0 ? (
              <p className="text-sm text-slate-500">{t('extra.no_favourites')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {favourites.map((fav) => (
                  <div key={fav.user_id} className="p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {fav.photo_url ? (
                        <img src={resolveMediaUrl(fav.photo_url)} alt={fav.full_name} className="w-11 h-11 rounded-xl object-cover shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-brand-blue text-white font-bold flex items-center justify-center shrink-0">
                          {fav.full_name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-slate-900 truncate inline-flex items-center gap-1">
                          <span>{fav.full_name}</span>
                          {fav.id_verification_status === 'verified' && <BadgeCheck className="w-3.5 h-3.5 text-brand-green shrink-0" />}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {language === 'bn' ? fav.service_location_bn : fav.service_location_en} • ★ {toLocaleDigits(Number(fav.rating_avg || 5).toFixed(1), language)}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link to={`/book/provider/${fav.user_id}`} className="px-3 py-1.5 rounded-xl bg-brand-orange text-white text-xs font-bold">
                        {t('home.book_now')}
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleRemoveFavourite(fav.user_id)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-red-600"
                        aria-label={t('extra.favourite_remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-brand-orange" />
              <span>{t('dashboard.notifications')}</span>
            </h2>
            {notifications.length === 0 ? (
              <p className="text-sm text-slate-500">{t('dashboard.no_notifications')}</p>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3 rounded-xl border ${n.is_read ? 'bg-slate-50 border-slate-100' : 'bg-blue-50/50 border-blue-200'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-sm">{language === 'bn' ? n.title_bn : n.title_en}</div>
                    {!n.is_read && (
                      <button type="button" onClick={() => handleMarkRead(n.id)} className="text-xs text-brand-blue font-bold">
                        {t('dashboard.mark_read')}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{language === 'bn' ? n.body_bn : n.body_en}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
