import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft, BadgeCheck, Calendar, Clock, MapPin, Search, Star } from 'lucide-react';
import { apiRequest, formatInr, toLocaleDigits } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS, CategoryIcon } from '../components/CategoryIcon';
import type { ServiceItem, WorkerProfile } from '../types';

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
        <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 w-full md:w-96">
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
  const { language } = useAuth();
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (category) params.set('category', category);
    if (query.trim()) params.set('q', query.trim());
    apiRequest<{ providers: WorkerProfile[] }>(`/providers?${params.toString()}`)
      .then((res) => setWorkers(res.providers))
      .catch((err) => {
        setWorkers([]);
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, [category, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('nav.workers')}</h1>
        <div className="flex items-center bg-white border border-slate-300 rounded-xl px-3 py-2 w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('marketplace.worker_search_placeholder')}
            className="w-full text-sm focus:outline-none"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory('')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold border ${!category ? 'bg-brand-blue text-white border-brand-blue' : 'bg-white border-slate-200 text-slate-700'}`}
        >
          {t('home.all_categories')}
        </button>
        {CATEGORY_SLUGS.map((slug) => (
          <button
            key={slug}
            type="button"
            onClick={() => setCategory(slug)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border ${category === slug ? 'bg-brand-green text-white border-brand-green' : 'bg-white border-slate-200 text-slate-700'}`}
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
      ) : workers.length === 0 ? (
        <p className="text-slate-500">{t('home.empty_results')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workers.map((w) => (
            <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
              <div className="flex items-center gap-3">
                {w.photo_url ? (
                  <img src={w.photo_url} alt={w.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand-blue text-white font-bold flex items-center justify-center">
                    {w.full_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900 inline-flex items-center gap-1">
                    <span>{w.full_name}</span>
                    <BadgeCheck className="w-4 h-4 text-brand-green" />
                  </div>
                  <div className="text-xs text-slate-500">{language === 'bn' ? w.service_location_bn : w.service_location_en}</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2">{language === 'bn' ? w.bio_bn : w.bio_en}</p>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="font-bold text-amber-600">
                  ★ {toLocaleDigits(Number(w.rating_avg).toFixed(1), language)} ({toLocaleDigits(w.reviews_count, language)})
                </span>
                <Link to={`/workers/${w.id}`} className="text-brand-blue font-bold hover:underline">
                  {t('home.view_profile')}
                </Link>
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
  const { language } = useAuth();
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

  if (error) return <div className="max-w-3xl mx-auto p-8 text-red-600">{error}</div>;
  if (!worker) return <div className="max-w-3xl mx-auto p-8 text-slate-500">{t('home.loading')}</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {worker.photo_url ? (
              <img src={worker.photo_url} alt={worker.full_name} className="w-16 h-16 rounded-2xl object-cover border border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-brand-green text-white text-2xl font-extrabold flex items-center justify-center">
                {worker.full_name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
                <span>{worker.full_name}</span>
                <BadgeCheck className="w-5 h-5 text-brand-blue" />
              </h1>
              <p className="text-sm text-slate-500">{language === 'bn' ? worker.service_location_bn : worker.service_location_en}</p>
            </div>
          </div>
          <div className="text-xs sm:text-sm text-slate-600 font-semibold">
            {toLocaleDigits(worker.experience_years, language)} {t('marketplace.years_exp')} • {toLocaleDigits(worker.completed_jobs, language)} {t('marketplace.jobs_done')}
          </div>
        </div>
        <p className="text-slate-700">{language === 'bn' ? worker.bio_bn : worker.bio_en}</p>
        <div className="flex flex-wrap gap-2">
          {worker.service_categories.map((slug) => (
            <span key={slug} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 text-brand-blue text-xs font-bold">
              <CategoryIcon slug={slug} className="w-3.5 h-3.5" />
              {t(`categories.${slug}`)}
            </span>
          ))}
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
  const { serviceId } = useParams();
  const { t } = useTranslation();
  const { user, language } = useAuth();
  const navigate = useNavigate();

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(serviceId || '');
  const [customerName, setCustomerName] = useState(user?.full_name || '');
  const [customerPhone, setCustomerPhone] = useState(user?.mobile_number || '');
  const [serviceAddress, setServiceAddress] = useState(user?.full_address || '');
  const [preferredDate, setPreferredDate] = useState('');
  const [preferredTime, setPreferredTime] = useState('10:00 AM - 12:00 PM');
  const [instructions, setInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<{ services: ServiceItem[] }>('/services')
      .then((res) => {
        setServices(res.services);
        if (!selectedServiceId && res.services.length) setSelectedServiceId(res.services[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      if (!customerName) setCustomerName(user.full_name);
      if (!customerPhone) setCustomerPhone(user.mobile_number);
      if (!serviceAddress) setServiceAddress(user.full_address);
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiRequest('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          serviceId: selectedServiceId,
          customerName,
          customerPhone,
          serviceAddress,
          preferredDate,
          preferredTime,
          instructions,
          languageAtBooking: language
        })
      });
      navigate('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-7 h-7 text-brand-blue" />
          <h1 className="text-2xl font-extrabold text-slate-900">{t('booking.title')}</h1>
        </div>

        {!user && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-900 flex flex-wrap items-center justify-between gap-2">
            <span>{t('marketplace.login_to_book')}</span>
            <Link to="/login" className="font-bold underline">{t('nav.login')}</Link>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-brand-green hover:bg-emerald-800 text-white font-bold transition"
          >
            {submitting ? t('home.loading') : t('booking.confirm')}
          </button>
        </form>
      </div>
    </div>
  );
};
