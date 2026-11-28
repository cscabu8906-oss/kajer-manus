import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  Briefcase,
  Calendar,
  Camera,
  Clock,
  Compass,
  CreditCard,
  Filter,
  Heart,
  MapPin,
  Navigation,
  Search,
  ShieldCheck,
  Star,
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
import { startRazorpayCheckout } from '../lib/razorpay';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS, CategoryIcon } from '../components/CategoryIcon';
import { EMPTY_WB_LOCATION, LocationCascadingSelect } from '../components/LocationCascadingSelect';
import type {
  BookingPaymentMethod,
  ProviderSearchMeta,
  SelectedWbLocation,
  ServiceCategory,
  ServiceItem,
  UserAddress,
  WorkerProfile
} from '../types';

export const ServicesListPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCat, setSelectedCat] = useState(searchParams.get('category') || '');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setSelectedCat(searchParams.get('category') || '');
    setQuery(searchParams.get('q') || '');
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (selectedCat) params.set('category', selectedCat);
    if (query.trim()) params.set('q', query.trim());
    apiRequest<{ services: ServiceItem[] }>(`/services?${params.toString()}`)
      .then((res) => setServices(res.services))
      .catch((err) => {
        setServices([]);
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, [selectedCat, query]);

  const updateFilters = (nextCat: string, nextQuery: string) => {
    setSelectedCat(nextCat);
    setQuery(nextQuery);
    const nextParams: Record<string, string> = {};
    if (nextCat) nextParams.category = nextCat;
    if (nextQuery.trim()) nextParams.q = nextQuery;
    setSearchParams(nextParams);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('nav.services')}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/workers${selectedCat ? `?category=${selectedCat}` : ''}`}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-50 text-brand-blue text-xs font-bold border border-blue-200 hover:bg-blue-100"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>{t('search.smart_title')}</span>
          </Link>
          <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => updateFilters(selectedCat, e.target.value)}
              placeholder={t('home.search_placeholder')}
              className="w-full text-sm focus:outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => updateFilters('', query)}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
            !selectedCat ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white text-slate-700 border-slate-200'
          }`}
        >
          {t('home.all_categories')}
        </button>
        {CATEGORY_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => updateFilters(slug, query)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
              selectedCat === slug ? 'bg-brand-green text-white border-brand-green' : 'bg-white text-slate-700 border-slate-200'
            }`}
          >
            <CategoryIcon slug={slug} className="w-3.5 h-3.5" />
            <span>{t(`categories.${slug}`)}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">{t('home.loading')}</p>
      ) : services.length === 0 ? (
        <p className="text-slate-500">{t('home.empty_results')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((svc) => (
            <div key={svc.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-brand-blue text-xs font-bold">
                    <CategoryIcon slug={svc.category_slug} className="w-3.5 h-3.5" />
                    {t(`categories.${svc.category_slug}`)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {toLocaleDigits(Number(svc.rating).toFixed(1), language)}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900">{language === 'bn' ? svc.title_bn : svc.title_en}</h2>
                <p className="text-sm text-slate-600">{language === 'bn' ? svc.description_bn : svc.description_en}</p>
                <div className="text-xs text-slate-500 pt-1">
                  {language === 'bn' ? svc.provider_name_bn : svc.provider_name_en} • {language === 'bn' ? svc.area_bn : svc.area_en}
                </div>
              </div>
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xl font-extrabold text-brand-green">{formatInr(svc.base_price_inr, language)}</span>
                <div className="flex gap-2">
                  <Link to={`/services/${svc.id}`} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
                    {t('home.view_details')}
                  </Link>
                  <Link to={`/book/${svc.id}`} className="px-4 py-2 rounded-xl bg-brand-orange text-white text-xs font-bold">
                    {t('home.book_now')}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ServiceDetailPage: React.FC = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const { language } = useAuth();
  const [service, setService] = useState<ServiceItem | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiRequest<{ service: ServiceItem }>(`/services/${id}`)
      .then((res) => setService(res.service))
      .catch((err) => setError((err as Error).message));
  }, [id]);

  if (error) return <div className="max-w-3xl mx-auto p-8 text-red-600">{error}</div>;
  if (!service) return <div className="max-w-3xl mx-auto p-8 text-slate-500">{t('home.loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
      <Link to="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="w-4 h-4" />
        <span>{t('marketplace.back_to_services')}</span>
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 text-brand-green text-sm font-bold">
            <CategoryIcon slug={service.category_slug} className="w-4 h-4" />
            {t(`categories.${service.category_slug}`)}
          </span>
          <span className="inline-flex items-center gap-1 font-bold text-amber-600">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            {toLocaleDigits(Number(service.rating).toFixed(1), language)}
          </span>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900">
          {language === 'bn' ? service.title_bn : service.title_en}
        </h1>
        <p className="text-slate-700 leading-relaxed">
          {language === 'bn' ? service.description_bn : service.description_en}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-brand-surface p-4 rounded-2xl">
          <div>
            <div className="text-xs text-slate-500">{t('nav.workers')}</div>
            <div className="font-bold text-slate-900">{language === 'bn' ? service.provider_name_bn : service.provider_name_en}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('marketplace.area')}</div>
            <div className="font-bold text-slate-900 inline-flex items-center gap-1">
              <MapPin className="w-4 h-4 text-brand-blue" />
              {language === 'bn' ? service.area_bn : service.area_en}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('marketplace.duration')}</div>
            <div className="font-bold text-slate-900 inline-flex items-center gap-1">
              <Clock className="w-4 h-4 text-brand-green" />
              {toLocaleDigits(service.duration_minutes, language)} {t('home.min_short')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-200">
          <div className="text-3xl font-extrabold text-brand-green">{formatInr(service.base_price_inr, language)}</div>
          <Link
            to={`/book/${service.id}`}
            className="px-8 py-3.5 rounded-2xl bg-brand-orange hover:bg-orange-600 text-white font-bold shadow-md transition"
          >
            {t('home.book_now')}
          </Link>
        </div>
      </div>
    </div>
  );
};

export const FindWorkersPage: React.FC = () => {
  const { t } = useTranslation();
  const { language, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [searchMeta, setSearchMeta] = useState<ProviderSearchMeta | null>(null);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  const [category, setCategory] = useState(searchParams.get('category') || '');
  const [subcategory, setSubcategory] = useState('');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [radiusMode, setRadiusMode] = useState<string>('auto');
  const [sortBy, setSortBy] = useState<string>('nearest');
  const [minRating, setMinRating] = useState<string>('');
  const [minExperience, setMinExperience] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);

  const [showLocationFilters, setShowLocationFilters] = useState<boolean>(false);
  const [wbLoc, setWbLoc] = useState<SelectedWbLocation>(() => ({
    ...EMPTY_WB_LOCATION,
    districtId: user?.district_id || '',
    subdivisionId: user?.subdivision_id || '',
    areaType: user?.area_type || '',
    localBodyId: user?.local_body_id || '',
    gpWardId: user?.gp_ward_id || '',
    pincode: user?.pincode || '',
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    gpsConsent: Boolean(user?.location_consent)
  }));
  const [gpsStatus, setGpsStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ categories: ServiceCategory[] }>('/categories')
      .then((res) => setCategories(res.categories))
      .catch(() => {});
  }, []);

  const currentSubcategories = useMemo(() => {
    const catObj = categories.find((c) => c.slug === category);
    return Array.isArray(catObj?.subcategories) ? catObj.subcategories : [];
  }, [categories, category]);

  const fetchWorkers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await providerSearchApi.search({
        category,
        subcategory,
        q: query.trim(),
        lat: wbLoc.gpsConsent ? wbLoc.latitude : undefined,
        lng: wbLoc.gpsConsent ? wbLoc.longitude : undefined,
        districtId: wbLoc.districtId,
        subdivisionId: wbLoc.subdivisionId,
        localBodyId: wbLoc.localBodyId,
        gpWardId: wbLoc.gpWardId,
        pincode: wbLoc.pincode,
        maxDistanceKm: radiusMode,
        minRating,
        minExperience,
        maxPrice,
        verifiedOnly: verifiedOnly ? 'true' : undefined,
        sortBy
      });
      setWorkers(res.providers);
      setSearchMeta(res.searchMeta);
    } catch (err) {
      setWorkers([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [category, subcategory, query, wbLoc, radiusMode, minRating, minExperience, maxPrice, verifiedOnly, sortBy]);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleDetectGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus(t('locations.gps_unavailable'));
      return;
    }
    setGpsStatus(t('locations.detecting_gps'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setWbLoc((prev) => ({ ...prev, latitude: lat, longitude: lng, gpsConsent: true }));
        setGpsStatus(`${t('locations.gps_detected')} (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
      },
      () => {
        setGpsStatus(t('locations.gps_denied_fallback'));
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleFav = async (worker: WorkerProfile) => {
    if (!user) return;
    const nextFav = !worker.is_favourite;
    setWorkers((prev) =>
      prev.map((w) => (w.user_id === worker.user_id ? { ...w, is_favourite: nextFav } : w))
    );
    try {
      await providerSearchApi.toggleFavourite(worker.user_id, nextFav);
    } catch {
      fetchWorkers();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
      {/* Header + GPS & Search Bar */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-emerald-50 rounded-3xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('search.smart_title')}</h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">{t('search.smart_subtitle')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDetectGps}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-blue hover:bg-blue-800 text-white text-xs sm:text-sm font-bold shadow-sm transition"
            >
              <Compass className="w-4 h-4" />
              <span>{t('locations.detect_gps')}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowLocationFilters((prev) => !prev)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition ${
                showLocationFilters
                  ? 'bg-brand-green text-white border-brand-green'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>{t('search.location_filters_toggle')}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2.5">
            <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('marketplace.worker_search_placeholder')}
              className="w-full text-sm focus:outline-none"
            />
          </div>

          <div className="md:col-span-4 flex flex-wrap items-center gap-1.5">
            {[
              { id: 'auto', label: t('search.radius_auto') },
              { id: '5', label: `5 ${t('search.km_unit')}` },
              { id: '10', label: `10 ${t('search.km_unit')}` },
              { id: '25', label: `25 ${t('search.km_unit')}` },
              { id: '50', label: `50 ${t('search.km_unit')}` }
            ].map((pill) => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setRadiusMode(pill.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  radiusMode === pill.id
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full border border-slate-300 bg-white rounded-xl px-3 py-2.5 text-xs sm:text-sm font-semibold"
            >
              <option value="nearest">{t('search.sort_nearest')}</option>
              <option value="rating">{t('search.sort_rating')}</option>
              <option value="price_asc">{t('search.sort_price')}</option>
              <option value="experience">{t('search.sort_experience')}</option>
            </select>
          </div>
        </div>

        {gpsStatus && <div className="text-xs font-semibold text-brand-blue">{gpsStatus}</div>}

        {showLocationFilters && (
          <div className="space-y-4 pt-2 border-t border-slate-200">
            <LocationCascadingSelect value={wbLoc} onChange={(next) => setWbLoc(next)} compact showGpsDetect={false} />
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center">
              <select
                value={minRating}
                onChange={(e) => setMinRating(e.target.value)}
                className="border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="">{t('search.min_rating')}</option>
                <option value="4.5">4.5 ★+</option>
                <option value="4">4.0 ★+</option>
                <option value="3.5">3.5 ★+</option>
              </select>
              <select
                value={minExperience}
                onChange={(e) => setMinExperience(e.target.value)}
                className="border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs font-semibold"
              >
                <option value="">{t('search.min_experience')}</option>
                <option value="1">1+ yr</option>
                <option value="3">3+ yrs</option>
                <option value="5">5+ yrs</option>
              </select>
              <input
                type="number"
                min={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder={t('search.max_price')}
                className="border border-slate-300 bg-white rounded-xl px-3 py-2 text-xs"
              />
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 accent-brand-green"
                />
                <span>{t('search.verified_only')}</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setWbLoc(EMPTY_WB_LOCATION);
                  setMinRating('');
                  setMinExperience('');
                  setMaxPrice('');
                  setVerifiedOnly(false);
                  setSubcategory('');
                  setRadiusMode('auto');
                }}
                className="py-2 px-3 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                {t('search.clear_filters')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Category & Subcategory Filter Strip */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory('');
              setSubcategory('');
              setSearchParams({});
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${!category ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200 text-slate-700'}`}
          >
            {t('home.all_categories')}
          </button>
          {CATEGORY_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => {
                setCategory(slug);
                setSubcategory('');
                setSearchParams({ category: slug });
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${category === slug ? 'bg-brand-green text-white border-brand-green' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              <CategoryIcon slug={slug} className="w-3.5 h-3.5" />
              <span>{t(`categories.${slug}`)}</span>
            </button>
          ))}
        </div>

        {currentSubcategories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {currentSubcategories.map((sub) => (
              <button
                key={sub.slug}
                type="button"
                onClick={() => setSubcategory((prev) => (prev === sub.slug ? '' : sub.slug))}
                className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                  subcategory === sub.slug
                    ? 'bg-brand-orange text-white border-brand-orange'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {language === 'bn' ? sub.name_bn : sub.name_en}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Radius Match Banner & Privacy Notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-4 py-2.5">
        <div className="font-semibold">
          {searchMeta?.matchedRadiusKm
            ? `${t('search.matched_within')} ${toLocaleDigits(searchMeta.matchedRadiusKm, language)} ${t('search.km_unit')}`
            : `${toLocaleDigits(workers.length, language)} ${t('nav.workers')}`}
        </div>
        <div className="inline-flex items-center gap-1.5 text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-green shrink-0" />
          <span>{t('search.privacy_note')}</span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">{t('home.loading')}</p>
      ) : workers.length === 0 ? (
        <p className="text-slate-500">{t('home.empty_results')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4 shadow-sm hover:shadow-md transition">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    {w.photo_url ? (
                      <img
                        src={resolveMediaUrl(w.photo_url)}
                        alt={w.full_name}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-2xl bg-brand-blue text-white font-bold text-xl flex items-center justify-center shrink-0">
                        {w.full_name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="font-extrabold text-slate-900 inline-flex items-center gap-1.5 flex-wrap">
                        <span>{w.full_name}</span>
                        {w.is_verified_provider && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-50 text-brand-green text-[10px] font-extrabold border border-emerald-200">
                            <BadgeCheck className="w-3 h-3" />
                            <span>{t('search.verified_badge')}</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-blue shrink-0" />
                        <span>{language === 'bn' ? w.service_location_bn : w.service_location_en}</span>
                      </div>
                    </div>
                  </div>

                  {user && (
                    <button
                      type="button"
                      onClick={() => handleToggleFav(w)}
                      aria-label={w.is_favourite ? t('extra.favourite_remove') : t('extra.favourite_add')}
                      className="p-2 rounded-xl hover:bg-rose-50 transition shrink-0"
                    >
                      <Heart
                        className={`w-4 h-4 ${w.is_favourite ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`}
                      />
                    </button>
                  )}
                </div>

                {/* Distance + Availability + Categories */}
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  {w.distance_km !== null && w.distance_km !== undefined && (
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-blue">
                      {toLocaleDigits(Number(w.distance_km).toFixed(1), language)} {t('search.away_suffix')}
                    </span>
                  )}
                  <span
                    className={`px-2.5 py-0.5 rounded-full ${
                      w.is_available ? 'bg-emerald-100 text-brand-green' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {w.is_available ? t('search.available_now') : t('search.currently_busy')}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {w.service_categories.slice(0, 3).map((slug) => (
                    <span key={slug} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-semibold">
                      <CategoryIcon slug={slug} className="w-3 h-3" />
                      <span>{t(`categories.${slug}`)}</span>
                    </span>
                  ))}
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">{language === 'bn' ? w.bio_bn : w.bio_en}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-bold text-amber-600">
                    ★ {toLocaleDigits(Number(w.rating_avg).toFixed(1), language)} ({toLocaleDigits(w.reviews_count, language)})
                  </span>
                  <span>
                    {toLocaleDigits(w.experience_years, language)} {t('marketplace.years_exp')} • {toLocaleDigits(w.completed_jobs, language)} {t('marketplace.jobs_done')}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500">{t('search.starting_from')}</div>
                    <div className="text-lg font-extrabold text-brand-green">
                      {formatInr(Number(w.starting_price_inr || 299), language)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      to={`/workers/${w.id}`}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                    >
                      {t('home.view_profile')}
                    </Link>
                    <Link
                      to={`/book/provider/${w.user_id}`}
                      className="px-4 py-2 rounded-xl bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold"
                    >
                      {t('home.book_now')}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const WorkerProfilePage: React.FC = () => {
  const { id } = useParams();
  const { t } = useTranslation();
  const { language, user } = useAuth();
  const [worker, setWorker] = useState<WorkerProfile | null>(null);
  const [reviews, setReviews] = useState<Array<{ id: string; rating: number; comment: string; customer_name: string }>>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    apiRequest<{ provider: WorkerProfile; reviews: Array<{ id: string; rating: number; comment: string; customer_name: string }> }>(`/providers/${id}`)
      .then((res) => {
        setWorker(res.provider);
        setReviews(res.reviews);
      })
      .catch((err) => setError((err as Error).message));
  }, [id]);

  const handleToggleFav = async () => {
    if (!user || !worker) return;
    const next = !worker.is_favourite;
    setWorker({ ...worker, is_favourite: next });
    try {
      await providerSearchApi.toggleFavourite(worker.user_id, next);
    } catch {
      setWorker({ ...worker, is_favourite: !next });
    }
  };

  if (error) return <div className="max-w-3xl mx-auto p-8 text-red-600">{error}</div>;
  if (!worker) return <div className="max-w-3xl mx-auto p-8 text-slate-500">{t('home.loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <Link to="/workers" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-blue hover:underline">
        <ArrowLeft className="w-4 h-4" />
        <span>{t('nav.workers')}</span>
      </Link>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {worker.photo_url ? (
              <img src={resolveMediaUrl(worker.photo_url)} alt={worker.full_name} className="w-20 h-20 rounded-2xl object-cover border border-slate-200" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-brand-green text-white text-2xl font-extrabold flex items-center justify-center">
                {worker.full_name.charAt(0)}
              </div>
            )}
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold text-slate-900 flex flex-wrap items-center gap-2">
                <span>{worker.full_name}</span>
                {worker.is_verified_provider && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-brand-green text-xs font-bold border border-emerald-200">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    <span>{t('search.verified_badge')}</span>
                  </span>
                )}
              </h1>
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-brand-blue" />
                <span>{language === 'bn' ? worker.service_location_bn : worker.service_location_en}</span>
              </p>
              <div className="text-xs font-semibold text-slate-600">
                ★ {toLocaleDigits(Number(worker.rating_avg).toFixed(1), language)} ({toLocaleDigits(worker.reviews_count, language)}) •{' '}
                {toLocaleDigits(worker.experience_years, language)} {t('marketplace.years_exp')} •{' '}
                {toLocaleDigits(worker.completed_jobs, language)} {t('marketplace.jobs_done')}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="text-xs text-slate-500">{t('search.starting_from')}</div>
            <div className="text-2xl font-extrabold text-brand-green">
              {formatInr(Number(worker.starting_price_inr || 299), language)}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <button
                  type="button"
                  onClick={handleToggleFav}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Heart className={`w-4 h-4 ${worker.is_favourite ? 'fill-rose-500 text-rose-500' : 'text-slate-500'}`} />
                  <span>{worker.is_favourite ? t('extra.favourite_remove') : t('extra.favourite_add')}</span>
                </button>
              )}
              <Link
                to={`/book/provider/${worker.user_id}`}
                className="px-5 py-2.5 rounded-xl bg-brand-orange hover:bg-orange-600 text-white text-sm font-bold shadow"
              >
                {t('home.book_now')}
              </Link>
            </div>
          </div>
        </div>

        <p className="text-slate-700 leading-relaxed">{language === 'bn' ? worker.bio_bn : worker.bio_en}</p>

        <div className="flex flex-wrap gap-2">
          {worker.service_categories.map((slug) => (
            <span key={slug} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-brand-blue text-xs font-bold">
              <CategoryIcon slug={slug} className="w-3.5 h-3.5" />
              {t(`categories.${slug}`)}
            </span>
          ))}
          {(worker.skills || []).map((sk) => (
            <span key={sk} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold">
              <Briefcase className="w-3 h-3" />
              <span>{sk}</span>
            </span>
          ))}
        </div>

        {worker.working_hours && (
          <div className="text-xs text-slate-600 bg-slate-50 rounded-xl p-3 flex flex-wrap items-center gap-2">
            <Clock className="w-4 h-4 text-brand-blue" />
            <span className="font-bold">{t('extra.working_hours')}:</span>
            <span>
              {worker.working_hours.days?.join(', ')} ({worker.working_hours.start} – {worker.working_hours.end})
            </span>
          </div>
        )}

        {Array.isArray(worker.service_areas) && worker.service_areas.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700">{t('extra.service_areas_title')}</div>
            <div className="flex flex-wrap gap-2">
              {worker.service_areas.map((sa, idx) => (
                <span key={sa.id || idx} className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-brand-green text-xs font-semibold">
                  {language === 'bn' ? sa.area_label_bn || sa.area_label_en : sa.area_label_en || sa.area_label_bn}
                  {sa.radius_km ? ` (${toLocaleDigits(sa.radius_km, language)} ${t('search.km_unit')})` : ''}
                </span>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(worker.portfolio_photos) && worker.portfolio_photos.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700">{t('extra.portfolio_photos_label')}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {worker.portfolio_photos.map((url, idx) => (
                <img
                  key={`${url}-${idx}`}
                  src={resolveMediaUrl(url)}
                  alt={`${worker.full_name} work ${idx + 1}`}
                  className="w-full h-28 object-cover rounded-xl border border-slate-200"
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-2 border-t border-slate-100">
          <ShieldCheck className="w-4 h-4 text-brand-green shrink-0" />
          <span>{t('search.privacy_note')}</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-xl font-bold text-slate-900">
          {t('marketplace.reviews_count')} ({toLocaleDigits(reviews.length, language)})
        </h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-slate-500">{t('marketplace.no_reviews')}</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between text-sm font-bold">
                <span>{r.customer_name}</span>
                <span className="text-amber-600">★ {toLocaleDigits(r.rating, language)}/{toLocaleDigits(5, language)}</span>
              </div>
              <p className="text-sm text-slate-600 mt-1">{r.comment}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export const BookingPage: React.FC = () => {
  const { serviceId, providerId } = useParams();
  const { t } = useTranslation();
  const { user, language } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceId || '');
  const [targetProvider, setTargetProvider] = useState<WorkerProfile | null>(null);
  const [selectedCategorySlug, setSelectedCategorySlug] = useState('');

  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('custom');

  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.mobile_number || '');
  const [serviceAddress, setServiceAddress] = useState(user?.full_address || '');
  const [wbLoc, setWbLoc] = useState<SelectedWbLocation>(() => ({
    ...EMPTY_WB_LOCATION,
    districtId: user?.district_id || '',
    subdivisionId: user?.subdivision_id || '',
    areaType: user?.area_type || '',
    localBodyId: user?.local_body_id || '',
    gpWardId: user?.gp_ward_id || '',
    pincode: user?.pincode || '',
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    gpsConsent: Boolean(user?.location_consent)
  }));

  const [problemPhotos, setProblemPhotos] = useState<string[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);

  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('10:00 AM - 12:00 PM');
  const [instructions, setInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<BookingPaymentMethod>('cash');
  const [idempotencyKey] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ services: ServiceItem[] }>('/services')
      .then((res) => {
        setServices(res.services);
        if (!providerId && !selectedServiceId && res.services.length) {
          setSelectedServiceId(res.services[0].id);
        }
      })
      .catch(() => {});
  }, [providerId]);

  useEffect(() => {
    if (!providerId) return;
    apiRequest<{ provider: WorkerProfile }>(`/providers/${providerId}`)
      .then((res) => {
        setTargetProvider(res.provider);
        setSelectedCategorySlug(res.provider.service_categories?.[0] || 'other_services');
      })
      .catch((err) => setError((err as Error).message));
  }, [providerId]);

  useEffect(() => {
    if (!user) return;
    if (!customerName) setCustomerName(user.full_name);
    if (!customerPhone) setCustomerPhone(user.mobile_number);
    if (!serviceAddress) setServiceAddress(user.full_address);
    apiRequest<{ addresses: UserAddress[] }>('/users/me')
      .then((res) => {
        setSavedAddresses(res.addresses);
        const def = res.addresses.find((a) => a.is_default) || res.addresses[0];
        if (def) {
          setSelectedAddressId(def.id);
          setServiceAddress(def.address_line);
          setWbLoc((prev) => ({
            ...prev,
            districtId: def.district_id || prev.districtId,
            subdivisionId: def.subdivision_id || prev.subdivisionId,
            areaType: def.area_type || prev.areaType,
            localBodyId: def.local_body_id || prev.localBodyId,
            gpWardId: def.gp_ward_id || prev.gpWardId,
            pincode: def.pincode || prev.pincode,
            latitude: def.latitude ?? prev.latitude,
            longitude: def.longitude ?? prev.longitude
          }));
        }
      })
      .catch(() => {});
  }, [user]);

  const handleSavedAddressChange = (addrId: string) => {
    setSelectedAddressId(addrId);
    const chosen = savedAddresses.find((a) => a.id === addrId);
    if (chosen) {
      setServiceAddress(chosen.address_line);
      setWbLoc({
        ...EMPTY_WB_LOCATION,
        districtId: chosen.district_id || '',
        subdivisionId: chosen.subdivision_id || '',
        areaType: chosen.area_type || '',
        localBodyId: chosen.local_body_id || '',
        gpWardId: chosen.gp_ward_id || '',
        villageId: chosen.village_id || '',
        villageLocality: chosen.village_locality || '',
        pincode: chosen.pincode || '',
        latitude: chosen.latitude ?? null,
        longitude: chosen.longitude ?? null,
        gpsConsent: false
      });
    }
  };

  const handleProblemPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5 - problemPhotos.length);
    if (!files.length) return;
    setError('');
    setPhotoUploading(true);
    try {
      const urls = await uploadImages(files, 'bookings');
      setProblemPhotos((prev) => [...prev, ...urls].slice(0, 5));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!user) {
      navigate('/login');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const created = await apiRequest<{ booking: { id: string } }>('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...(selectedServiceId ? { serviceId: selectedServiceId } : {}),
          ...(targetProvider ? { providerId: targetProvider.user_id, categorySlug: selectedCategorySlug } : {}),
          customerName,
          customerPhone,
          serviceAddress,
          districtId: wbLoc.districtId || null,
          subdivisionId: wbLoc.subdivisionId || null,
          localBodyId: wbLoc.localBodyId || null,
          gpWardId: wbLoc.gpWardId || null,
          villageId: wbLoc.villageId || null,
          pincode: wbLoc.pincode || '',
          latitude: wbLoc.latitude,
          longitude: wbLoc.longitude,
          problemPhotos,
          idempotencyKey,
          preferredDate,
          preferredTime,
          instructions,
          paymentMethod,
          languageAtBooking: language
        })
      });
      if (paymentMethod === 'razorpay' && created.booking?.id) {
        await startRazorpayCheckout({
          bookingId: created.booking.id,
          onSuccess: () => navigate('/dashboard'),
          onError: () => navigate('/dashboard'),
          onDismiss: () => navigate('/dashboard')
        });
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-7 h-7 text-brand-blue" />
          <h1 className="text-2xl font-extrabold text-slate-900">{t('booking.title')}</h1>
        </div>

        {targetProvider && (
          <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {targetProvider.photo_url ? (
                <img src={resolveMediaUrl(targetProvider.photo_url)} alt={targetProvider.full_name} className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-brand-blue text-white font-bold flex items-center justify-center">
                  {targetProvider.full_name.charAt(0)}
                </div>
              )}
              <div>
                <div className="font-bold text-slate-900 inline-flex items-center gap-1">
                  <span>{targetProvider.full_name}</span>
                  {targetProvider.is_verified_provider && <BadgeCheck className="w-4 h-4 text-brand-green" />}
                </div>
                <div className="text-xs text-slate-600">
                  {language === 'bn' ? targetProvider.service_location_bn : targetProvider.service_location_en}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">{t('search.starting_from')}</div>
              <div className="text-lg font-extrabold text-brand-green">
                {formatInr(Number(targetProvider.starting_price_inr || 299), language)}
              </div>
            </div>
          </div>
        )}

        {!user && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <span>{t('marketplace.login_to_book')}</span>
            <Link to="/login" className="font-bold underline">{t('nav.login')}</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {targetProvider ? (
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.selected_service')}</label>
              <select
                value={selectedCategorySlug}
                onChange={(e) => setSelectedCategorySlug(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                required
              >
                {targetProvider.service_categories.map((slug) => (
                  <option key={slug} value={slug}>
                    {t(`categories.${slug}`)}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.selected_service')}</label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(language === 'bn' ? s.title_bn : s.title_en)} — {formatInr(s.base_price_inr, language)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.customer_name')}</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.mobile')}</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          {savedAddresses.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">{t('extra.saved_address_pick')}</label>
              <select
                value={selectedAddressId}
                onChange={(e) => handleSavedAddressChange(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50"
              >
                {savedAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label} — {addr.address_line} {addr.pincode ? `(${addr.pincode})` : ''}
                  </option>
                ))}
                <option value="custom">{t('extra.custom_address_option')}</option>
              </select>
            </div>
          )}

          <LocationCascadingSelect
            value={wbLoc}
            onChange={(next, label) => {
              setWbLoc(next);
              const str = language === 'bn' ? label?.bn || label?.en : label?.en || label?.bn;
              if (str && selectedAddressId === 'custom' && !serviceAddress) {
                setServiceAddress(str);
              }
            }}
            compact
          />

          <div>
            <label className="block text-sm font-semibold mb-1">{t('booking.address')}</label>
            <textarea
              value={serviceAddress}
              onChange={(e) => setServiceAddress(e.target.value)}
              rows={2}
              required
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.preferred_date')}</label>
              <input
                type="date"
                min={minDate}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                required
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">{t('booking.preferred_time')}</label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
              >
                <option value="10:00 AM - 12:00 PM">{t('marketplace.slot_morning')}</option>
                <option value="2:00 PM - 4:00 PM">{t('marketplace.slot_afternoon')}</option>
                <option value="5:00 PM - 7:00 PM">{t('marketplace.slot_evening')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">{t('booking.instructions')}</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm"
            />
          </div>

          {/* Problem Photos Upload */}
          {user && (
            <div className="space-y-2">
              <label className="block text-sm font-semibold">{t('extra.problem_photos_label')}</label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-brand-blue text-brand-blue text-xs font-bold cursor-pointer hover:bg-blue-50">
                  <Camera className="w-4 h-4" />
                  <span>{photoUploading ? t('extra.uploading') : t('extra.upload_photo')}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    disabled={photoUploading || problemPhotos.length >= 5}
                    onChange={handleProblemPhotoUpload}
                    className="hidden"
                  />
                </label>
                {problemPhotos.map((url, idx) => (
                  <div key={`${url}-${idx}`} className="relative">
                    <img src={resolveMediaUrl(url)} alt="Problem" className="w-14 h-14 rounded-xl object-cover border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => setProblemPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-2">{t('booking.payment_method_label')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition ${
                  paymentMethod === 'cash'
                    ? 'border-brand-green bg-emerald-50 text-brand-green ring-2 ring-brand-green/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Banknote className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-sm font-bold">{t('booking.method_cash')}</div>
                  <div className="text-xs opacity-80">{t('booking.method_cash_desc')}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('razorpay')}
                className={`p-3.5 rounded-2xl border text-left flex items-center gap-3 transition ${
                  paymentMethod === 'razorpay'
                    ? 'border-brand-blue bg-blue-50 text-brand-blue ring-2 ring-brand-blue/20'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <CreditCard className="w-5 h-5 shrink-0" />
                <div>
                  <div className="text-sm font-bold">{t('booking.method_razorpay')}</div>
                  <div className="text-xs opacity-80">{t('booking.method_razorpay_desc')}</div>
                </div>
              </button>
            </div>
          </div>

          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-brand-green hover:bg-emerald-800 text-white font-bold transition disabled:opacity-60"
          >
            {submitting ? t('home.loading') : paymentMethod === 'razorpay' ? t('booking.confirm_and_pay') : t('booking.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
};
