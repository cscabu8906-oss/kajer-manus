import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  BadgeCheck,
  Briefcase,
  Camera,
  CheckCircle2,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
  X
} from 'lucide-react';
import {
  apiRequest,
  formatInr,
  providerSearchApi,
  resolveMediaUrl,
  toLocaleDigits,
  uploadImages
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS } from '../components/CategoryIcon';
import { EMPTY_WB_LOCATION, LocationCascadingSelect } from '../components/LocationCascadingSelect';
import type {
  BookingItem,
  ProviderEarningsSummary,
  SelectedWbLocation,
  ServiceAreaItem,
  ServiceCategory,
  WorkerProfile
} from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ProviderDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, loading, language, switchLanguage } = useAuth();
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; customer_name: string }>>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [earnings, setEarnings] = useState<ProviderEarningsSummary | null>(null);

  const [bioBn, setBioBn] = useState('');
  const [bioEn, setBioEn] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [wbLoc, setWbLoc] = useState<SelectedWbLocation>(EMPTY_WB_LOCATION);
  const [locationBn, setLocationBn] = useState('কলকাতা');
  const [locationEn, setLocationEn] = useState('Kolkata');

  const [selectedCategories, setSelectedCategories] = useState<string[]>(['electrician']);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [skillsText, setSkillsText] = useState('');
  const [experienceYears, setExperienceYears] = useState(2);
  const [startingPriceInr, setStartingPriceInr] = useState(299);
  const [workDays, setWorkDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('20:00');
  const [portfolioPhotos, setPortfolioPhotos] = useState<string[]>([]);

  const [idDocType, setIdDocType] = useState('Aadhaar');
  const [idDocMasked, setIdDocMasked] = useState('');
  const [idDocUrls, setIdDocUrls] = useState<string[]>([]);

  // Multi-location service areas
  const [serviceAreas, setServiceAreas] = useState<ServiceAreaItem[]>([]);
  const [newAreaLoc, setNewAreaLoc] = useState<SelectedWbLocation>(EMPTY_WB_LOCATION);
  const [newAreaLabel, setNewAreaLabel] = useState<{ en: string; bn: string }>({ en: '', bn: '' });
  const [newAreaRadius, setNewAreaRadius] = useState(10);

  const [uploadingKey, setUploadingKey] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [meRes, bRes, catRes, earnRes] = await Promise.all([
        apiRequest<{
          profile: WorkerProfile | null;
          reviews: Array<{ id: string; rating: number; comment: string; customer_name: string }>;
          serviceAreas?: ServiceAreaItem[];
        }>('/provider/me'),
        apiRequest<{ bookings: BookingItem[] }>('/bookings/provider').catch(() => ({ bookings: [] })),
        apiRequest<{ categories: ServiceCategory[] }>('/categories').catch(() => ({ categories: [] })),
        providerSearchApi.getEarnings().catch(() => ({ earnings: null, recentCompleted: [] }))
      ]);
      setProfile(meRes.profile);
      setReviews(meRes.reviews);
      setBookings(bRes.bookings);
      setCategories(catRes.categories || []);
      setServiceAreas(meRes.serviceAreas || []);
      if (earnRes.earnings) setEarnings(earnRes.earnings);

      if (meRes.profile) {
        const p = meRes.profile;
        setBioBn(p.bio_bn || '');
        setBioEn(p.bio_en || '');
        setPhotoUrl(p.photo_url || '');
        setLocationBn(p.service_location_bn || 'কলকাতা');
        setLocationEn(p.service_location_en || 'Kolkata');
        setSelectedCategories(p.service_categories?.length ? p.service_categories : ['electrician']);
        setSelectedSubcategories(p.subcategories || []);
        setSkillsText((p.skills || []).join(', '));
        setExperienceYears(p.experience_years ?? 2);
        setStartingPriceInr(p.starting_price_inr ?? 299);
        if (p.working_hours) {
          setWorkDays(p.working_hours.days || WEEKDAYS.slice(0, 6));
          setWorkStart(p.working_hours.start || '09:00');
          setWorkEnd(p.working_hours.end || '20:00');
        }
        setPortfolioPhotos(Array.isArray(p.portfolio_photos) ? p.portfolio_photos : []);
        setIdDocType(p.id_doc_type || 'Aadhaar');
        setIdDocMasked(p.id_doc_number_masked || '');
        setIdDocUrls(Array.isArray(p.id_doc_urls) ? p.id_doc_urls : []);
        setWbLoc({
          stateName: 'West Bengal',
          districtId: p.district_id || '',
          subdivisionId: p.subdivision_id || '',
          areaType: p.area_type || '',
          localBodyId: p.local_body_id || '',
          gpWardId: p.gp_ward_id || '',
          villageId: p.village_id || '',
          villageLocality: p.village_locality || '',
          pincode: p.pincode || '',
          latitude: null,
          longitude: null,
          gpsConsent: false
        });
      }
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const availableSubcategories = useMemo(() => {
    const subs: Array<{ slug: string; name_bn: string; name_en: string }> = [];
    categories
      .filter((c) => selectedCategories.includes(c.slug))
      .forEach((c) => {
        if (Array.isArray(c.subcategories)) {
          subs.push(...c.subcategories);
        }
      });
    return subs;
  }, [categories, selectedCategories]);

  if (loading) return <div className="p-10 text-center">{t('home.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;

  const toggleCat = (slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? (prev.length > 1 ? prev.filter((c) => c !== slug) : prev) : [...prev, slug]
    );
  };

  const toggleSubcat = (slug: string) => {
    setSelectedSubcategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingKey('avatar');
    setError('');
    try {
      const urls = await uploadImages([file], 'avatars');
      if (urls[0]) setPhotoUrl(urls[0]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingKey('');
    }
  };

  const handleUploadPortfolio = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 10 - portfolioPhotos.length);
    if (!files.length) return;
    setUploadingKey('portfolio');
    setError('');
    try {
      const urls = await uploadImages(files, 'portfolio');
      setPortfolioPhotos((prev) => [...prev, ...urls].slice(0, 10));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingKey('');
    }
  };

  const handleUploadKyc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - idDocUrls.length);
    if (!files.length) return;
    setUploadingKey('kyc');
    setError('');
    try {
      const urls = await uploadImages(files, 'kyc');
      setIdDocUrls((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingKey('');
    }
  };

  const handleSaveProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    setError('');
    const skills = skillsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await apiRequest('/provider/apply', {
        method: 'POST',
        body: JSON.stringify({
          bioBn,
          bioEn,
          photoUrl,
          serviceCategories: selectedCategories,
          subcategories: selectedSubcategories,
          skills,
          startingPriceInr: Number(startingPriceInr) || 299,
          workingHours: { days: workDays, start: workStart, end: workEnd },
          portfolioPhotos,
          idDocType,
          idDocNumberMasked: idDocMasked,
          idDocUrls,
          districtId: wbLoc.districtId || null,
          subdivisionId: wbLoc.subdivisionId || null,
          areaType: wbLoc.areaType || '',
          localBodyId: wbLoc.localBodyId || null,
          gpWardId: wbLoc.gpWardId || null,
          villageId: wbLoc.villageId || null,
          villageLocality: wbLoc.villageLocality || '',
          pincode: wbLoc.pincode || '',
          latitude: wbLoc.latitude,
          longitude: wbLoc.longitude,
          gpsConsent: wbLoc.gpsConsent,
          serviceLocationBn: locationBn,
          serviceLocationEn: locationEn,
          experienceYears: Number(experienceYears),
          isAvailable: profile?.is_available ?? true
        })
      });
      setMsg(t('provider.profile_saved'));
      loadData();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddAndSaveServiceAreas = async (nextAreas: ServiceAreaItem[]) => {
    setError('');
    setMsg('');
    try {
      const normalized = nextAreas.map((a) => ({
        districtId: a.district_id || a.districtId || null,
        subdivisionId: a.subdivision_id || a.subdivisionId || null,
        localBodyId: a.local_body_id || a.localBodyId || null,
        gpWardId: a.gp_ward_id || a.gpWardId || null,
        villageId: a.village_id || a.villageId || null,
        pincode: a.pincode || '',
        areaLabelEn: a.area_label_en || a.areaLabelEn || '',
        areaLabelBn: a.area_label_bn || a.areaLabelBn || '',
        latitude: a.latitude ?? null,
        longitude: a.longitude ?? null,
        radiusKm: a.radius_km || a.radiusKm || 10
      }));
      const res = await providerSearchApi.saveServiceAreas(normalized);
      setServiceAreas(res.serviceAreas);
      setMsg(t('provider.profile_saved'));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAddAreaClick = async () => {
    if (!newAreaLoc.districtId && !newAreaLoc.pincode) return;
    const item: ServiceAreaItem = {
      districtId: newAreaLoc.districtId || null,
      subdivisionId: newAreaLoc.subdivisionId || null,
      localBodyId: newAreaLoc.localBodyId || null,
      gpWardId: newAreaLoc.gpWardId || null,
      villageId: newAreaLoc.villageId || null,
      pincode: newAreaLoc.pincode || '',
      areaLabelEn: newAreaLabel.en || 'West Bengal',
      areaLabelBn: newAreaLabel.bn || 'পশ্চিমবঙ্গ',
      latitude: newAreaLoc.latitude,
      longitude: newAreaLoc.longitude,
      radiusKm: Number(newAreaRadius) || 10
    };
    const next = [...serviceAreas, item];
    setNewAreaLoc(EMPTY_WB_LOCATION);
    await handleAddAndSaveServiceAreas(next);
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

  const kycStatus = profile?.id_verification_status || 'pending';

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

      {/* Admin Approval & KYC Status Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!profile?.is_approved || profile?.approval_status === 'suspended' ? (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-900 text-sm font-semibold">
            <AlertTriangle className="w-5 h-5 shrink-0 text-brand-orange" />
            <span>
              {profile?.approval_status === 'suspended'
                ? 'Account suspended — contact support.'
                : t('dashboard.approval_pending')}
            </span>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-brand-green text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{t('dashboard.approval_approved')}</span>
          </div>
        )}

        <div
          className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-semibold ${
            kycStatus === 'verified'
              ? 'bg-emerald-50 border-emerald-200 text-brand-green'
              : kycStatus === 'rejected'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-brand-blue'
          }`}
        >
          <ShieldCheck className="w-5 h-5 shrink-0" />
          <span>{t(`extra.kyc_status_${kycStatus}`)}</span>
        </div>
      </div>

      {/* Earnings & Jobs Summary */}
      {earnings && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500 flex items-center gap-1"><Wallet className="w-3.5 h-3.5 text-brand-green" />{t('extra.total_earnings')}</div>
            <div className="text-xl font-extrabold text-brand-green mt-1">{formatInr(earnings.total_earnings_inr, language)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{t('extra.this_month_earnings')}</div>
            <div className="text-xl font-extrabold text-brand-blue mt-1">{formatInr(earnings.this_month_inr, language)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{t('extra.paid_online')}</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{formatInr(earnings.paid_online_inr, language)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{t('extra.active_jobs_count')}</div>
            <div className="text-xl font-extrabold text-brand-orange mt-1">{toLocaleDigits(earnings.active_jobs, language)}</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="text-xs text-slate-500">{t('extra.completed_jobs_count')}</div>
            <div className="text-xl font-extrabold text-slate-900 mt-1">{toLocaleDigits(earnings.completed_jobs, language)}</div>
          </div>
        </div>
      )}

      {msg && <div className="p-3 rounded-xl bg-blue-50 text-brand-blue text-sm font-semibold">{msg}</div>}
      {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm font-semibold">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Complete Provider Registration / Profile Editor */}
        <form onSubmit={handleSaveProvider} className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              {photoUrl ? (
                <img src={resolveMediaUrl(photoUrl)} alt={user.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-brand-blue text-white font-bold flex items-center justify-center">
                  {user.full_name.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold">{t('provider.profile_title')}</h2>
                {kycStatus === 'verified' && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    <span>{t('search.verified_badge')}</span>
                  </span>
                )}
              </div>
            </div>
            <label className="inline-flex items-center gap-1 text-xs font-bold text-brand-blue cursor-pointer hover:underline">
              <Camera className="w-3.5 h-3.5" />
              <span>{uploadingKey === 'avatar' ? t('extra.uploading') : t('extra.upload_photo')}</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleUploadAvatar} className="hidden" />
            </label>
          </div>

          {/* WB Administrative Base Location */}
          <LocationCascadingSelect
            value={wbLoc}
            onChange={(next, label) => {
              setWbLoc(next);
              if (label?.en) setLocationEn(label.en);
              if (label?.bn) setLocationBn(label.bn);
            }}
            compact
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={locationBn} onChange={(e) => setLocationBn(e.target.value)} placeholder={t('provider.location_bn')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
            <input type="text" value={locationEn} onChange={(e) => setLocationEn(e.target.value)} placeholder={t('provider.location_en')} required className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('provider.experience_years')}</label>
              <input type="number" min={0} value={experienceYears} onChange={(e) => setExperienceYears(Number(e.target.value))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('extra.starting_price_label')}</label>
              <input type="number" min={50} value={startingPriceInr} onChange={(e) => setStartingPriceInr(Number(e.target.value))} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
            </div>
          </div>

          <textarea value={bioBn} onChange={(e) => setBioBn(e.target.value)} rows={2} placeholder={t('provider.bio_bn')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />
          <textarea value={bioEn} onChange={(e) => setBioEn(e.target.value)} rows={2} placeholder={t('provider.bio_en')} className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs" />

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

          {availableSubcategories.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1.5">{t('extra.subcategories_label')}</div>
              <div className="flex flex-wrap gap-1.5">
                {availableSubcategories.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => toggleSubcat(sub.slug)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                      selectedSubcategories.includes(sub.slug)
                        ? 'bg-brand-orange text-white border-brand-orange'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {language === 'bn' ? sub.name_bn : sub.name_en}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">{t('extra.skills_label')}</label>
            <input
              type="text"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
              placeholder="MCB repair, Inverter wiring, Geyser installation"
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs"
            />
          </div>

          {/* Working Hours */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-brand-blue" />
              <span>{t('extra.working_hours')}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setWorkDays((prev) =>
                      prev.includes(day) ? (prev.length > 1 ? prev.filter((d) => d !== day) : prev) : [...prev, day]
                    )
                  }
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                    workDays.includes(day) ? 'bg-brand-green text-white' : 'bg-white border border-slate-200 text-slate-600'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} className="border rounded-xl px-2.5 py-1.5 text-xs bg-white" />
              <input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} className="border rounded-xl px-2.5 py-1.5 text-xs bg-white" />
            </div>
          </div>

          {/* Portfolio Photos */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">{t('extra.portfolio_photos_label')}</span>
              <label className="text-xs font-bold text-brand-blue cursor-pointer hover:underline">
                {uploadingKey === 'portfolio' ? t('extra.uploading') : `+ ${t('extra.upload_photo')}`}
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleUploadPortfolio} className="hidden" />
              </label>
            </div>
            {portfolioPhotos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {portfolioPhotos.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative">
                    <img src={resolveMediaUrl(url)} alt="Work sample" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setPortfolioPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KYC Identity Verification Documents */}
          <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200 space-y-2.5">
            <div className="text-xs font-bold text-slate-800">{t('extra.kyc_section_title')}</div>
            <div className="grid grid-cols-2 gap-2">
              <select value={idDocType} onChange={(e) => setIdDocType(e.target.value)} className="border border-slate-300 bg-white rounded-xl px-2.5 py-2 text-xs">
                <option value="Aadhaar">Aadhaar Card (Masked)</option>
                <option value="VoterID">Voter ID</option>
                <option value="PAN">PAN Card</option>
                <option value="DrivingLicence">Driving Licence</option>
              </select>
              <input
                type="text"
                value={idDocMasked}
                onChange={(e) => setIdDocMasked(e.target.value)}
                placeholder={t('extra.kyc_doc_masked')}
                className="border border-slate-300 bg-white rounded-xl px-2.5 py-2 text-xs"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-brand-blue text-brand-blue text-xs font-bold cursor-pointer">
                <Camera className="w-3.5 h-3.5" />
                <span>{uploadingKey === 'kyc' ? t('extra.uploading') : t('extra.kyc_doc_upload')}</span>
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleUploadKyc} className="hidden" />
              </label>
              {idDocUrls.map((url, idx) => (
                <div key={`${url}-${idx}`} className="relative">
                  <img src={resolveMediaUrl(url)} alt="KYC" className="w-10 h-10 rounded-lg object-cover border border-slate-300" />
                  <button
                    type="button"
                    onClick={() => setIdDocUrls((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-3 rounded-xl bg-brand-green text-white font-bold text-sm hover:bg-emerald-800">
            {t('dashboard.save_changes')}
          </button>
        </form>

        {/* Right: Multi-Area Service Areas + Booking Requests + Customer Reviews */}
        <div className="lg:col-span-7 space-y-6">
          {/* Multiple Nearby Service Areas */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-blue" />
              <span>{t('extra.service_areas_title')}</span>
            </h2>
            {serviceAreas.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {serviceAreas.map((sa, idx) => (
                  <div
                    key={sa.id || idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-brand-green text-xs font-semibold"
                  >
                    <span>
                      {language === 'bn' ? sa.area_label_bn || sa.areaLabelBn || sa.area_label_en : sa.area_label_en || sa.areaLabelEn}
                      {sa.pincode ? ` (${sa.pincode})` : ''} • {toLocaleDigits(sa.radius_km || sa.radiusKm || 10, language)} {t('search.km_unit')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddAndSaveServiceAreas(serviceAreas.filter((_, i) => i !== idx))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <LocationCascadingSelect
              value={newAreaLoc}
              onChange={(next, label) => {
                setNewAreaLoc(next);
                if (label) setNewAreaLabel(label);
              }}
              compact
            />
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">{t('extra.radius_coverage')}</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newAreaRadius}
                  onChange={(e) => setNewAreaRadius(Number(e.target.value))}
                  className="w-20 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs"
                />
              </div>
              <button
                type="button"
                disabled={!newAreaLoc.districtId && !newAreaLoc.pincode}
                onClick={handleAddAreaClick}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-blue text-white text-xs font-bold disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>{t('extra.add_service_area')}</span>
              </button>
            </div>
          </div>

          {/* Booking Requests */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-xl font-bold">{t('provider.booking_requests')}</h2>
            {bookings.length === 0 ? (
              <p className="text-sm text-slate-500">{t('home.empty_results')}</p>
            ) : (
              bookings.map((b) => {
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
                return (
                  <div key={b.id} className="p-4 rounded-2xl border border-slate-200 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold">{language === 'bn' ? b.service_title_bn : b.service_title_en}</span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${pBadgeClass}`}>
                          {t(`booking.payment_status_${pStatus}`)}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100">{t(`booking.${b.status}`)}</span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-2">
                      <span>
                        {b.customer_name} • {toLocaleDigits(b.customer_phone, language)} • {b.service_address} {b.pincode ? `(${b.pincode})` : ''} • {formatInr(b.amount_inr, language)}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                        {pMethod === 'razorpay' ? t('booking.method_razorpay') : t('booking.method_cash')}
                      </span>
                    </div>
                    {b.instructions && <p className="text-xs text-slate-500 italic">{b.instructions}</p>}
                    {Array.isArray(b.problem_photos) && b.problem_photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {b.problem_photos.map((url, idx) => (
                          <img key={`${url}-${idx}`} src={resolveMediaUrl(url)} alt="Issue" className="w-14 h-14 rounded-lg object-cover border border-slate-200" />
                        ))}
                      </div>
                    )}
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
                );
              })
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
