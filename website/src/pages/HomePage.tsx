import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Headphones,
  MapPin,
  Quote,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Star
} from 'lucide-react';
import { apiRequest, formatInr, toLocaleDigits } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_SLUGS, CategoryIcon } from '../components/CategoryIcon';
import type { ServiceCategory, ServiceItem, WorkerProfile } from '../types';

interface SiteContentRow {
  key: string;
  value_bn: string;
  value_en: string;
}

export const HomePage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [workers, setWorkers] = useState<WorkerProfile[]>([]);
  const [cmsMap, setCmsMap] = useState<Record<string, { bn: string; en: string }>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const loadHomeData = useCallback(() => {
    setLoading(true);
    setLoadFailed(false);
    Promise.allSettled([
      apiRequest<{ categories: ServiceCategory[] }>('/categories'),
      apiRequest<{ services: ServiceItem[] }>('/services'),
      apiRequest<{ providers: WorkerProfile[] }>('/providers'),
      apiRequest<{ content: SiteContentRow[] }>('/content')
    ])
      .then(([catRes, svcRes, provRes, cmsRes]) => {
        const allFailed =
          catRes.status === 'rejected' &&
          svcRes.status === 'rejected' &&
          provRes.status === 'rejected';
        setLoadFailed(allFailed);

        if (catRes.status === 'fulfilled') setCategories(catRes.value.categories);
        if (svcRes.status === 'fulfilled') setServices(svcRes.value.services);
        if (provRes.status === 'fulfilled') setWorkers(provRes.value.providers);
        if (cmsRes.status === 'fulfilled') {
          const nextCms: Record<string, { bn: string; en: string }> = {};
          cmsRes.value.content.forEach((row) => {
            nextCms[row.key] = { bn: row.value_bn, en: row.value_en };
          });
          setCmsMap(nextCms);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHomeData();
  }, [loadHomeData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/services?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const displayCategorySlugs = categories.length ? categories.map((c) => c.slug) : [...CATEGORY_SLUGS];
  const getCmsText = (key: string, fallbackKey: string) => {
    const entry = cmsMap[key];
    if (entry) {
      const val = language === 'bn' ? entry.bn : entry.en;
      if (val && val.trim()) return val;
    }
    return t(fallbackKey);
  };

  const heroHeadline = getCmsText('hero_headline', 'home.hero_headline');
  const heroDescription = getCmsText('hero_description', 'home.hero_description');
  const announcementBanner = getCmsText('announcement_banner', 'home.announcement_default');

  const testimonials = [
    {
      quote: t('home.testimonial_1_quote'),
      name: t('home.testimonial_1_name'),
      area: t('home.testimonial_1_area')
    },
    {
      quote: t('home.testimonial_2_quote'),
      name: t('home.testimonial_2_name'),
      area: t('home.testimonial_2_area')
    },
    {
      quote: t('home.testimonial_3_quote'),
      name: t('home.testimonial_3_name'),
      area: t('home.testimonial_3_area')
    }
  ];

  return (
    <div>
      {/* Live CMS Announcement Strip */}
      <div className="bg-brand-orange text-white text-xs sm:text-sm font-semibold py-2 px-4 text-center">
        {announcementBanner}
      </div>

      {/* Hero Section */}
      <section className="km-gradient-hero text-white py-14 md:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur text-sm font-semibold text-emerald-200">
              <ShieldCheck className="w-4 h-4 text-brand-orange" />
              <span>{t('home.hero_badge')}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
              {heroHeadline}
            </h1>

            <p className="text-base sm:text-lg text-blue-100 max-w-2xl leading-relaxed">
              {heroDescription}
            </p>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl p-2 shadow-xl flex flex-col sm:flex-row gap-2 max-w-2xl">
              <div className="flex items-center flex-1 px-3 gap-2">
                <Search className="w-5 h-5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('home.search_placeholder')}
                  className="w-full py-2.5 text-slate-900 placeholder:text-slate-400 focus:outline-none text-sm sm:text-base"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-brand-orange hover:bg-orange-600 text-white font-bold text-sm sm:text-base transition shrink-0"
              >
                {t('home.search_btn')}
              </button>
            </form>

            {/* Prominent Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                to="/services"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-brand-blue font-bold hover:bg-blue-50 transition shadow-md"
              >
                <span>{t('home.cta_find_services')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/register?role=provider"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-green hover:bg-emerald-800 text-white font-bold border border-emerald-400/40 transition"
              >
                <span>{t('home.cta_become_provider')}</span>
              </Link>
              <Link
                to="/download-app"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold border border-white/25 transition"
              >
                <Smartphone className="w-4 h-4 text-brand-orange" />
                <span>{t('home.cta_download_app')}</span>
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 space-y-4">
            <div className="rounded-3xl overflow-hidden shadow-2xl ring-2 ring-white/25 bg-white">
              <img
                src="/banner.png"
                alt={heroHeadline}
                className="w-full aspect-video object-cover block"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-blue-100 text-xs">{t('home.categories_title')}</span>
                <span className="font-bold text-xl text-brand-orange">
                  {toLocaleDigits(`${displayCategorySlugs.length}+`, language)}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur rounded-xl px-4 py-3 flex items-center justify-between">
                <span className="text-blue-100 text-xs">{t('home.hero_badge')}</span>
                <span className="font-bold text-xl text-emerald-300">
                  {toLocaleDigits('100%', language)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {loadFailed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex flex-wrap items-center justify-between gap-3 text-sm text-red-800">
            <span className="inline-flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {t('home.load_error')}
            </span>
            <button
              type="button"
              onClick={loadHomeData}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('home.retry')}
            </button>
          </div>
        </div>
      )}

      {/* 12 Service Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-2">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('home.categories_title')}</h2>
            <p className="text-slate-600 mt-1">{t('home.categories_subtitle')}</p>
          </div>
          <Link to="/services" className="text-brand-blue font-semibold inline-flex items-center gap-1 hover:underline">
            <span>{t('nav.services')}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {displayCategorySlugs.map((slug) => {
            const cat = categories.find((c) => c.slug === slug);
            const title = cat ? (language === 'bn' ? cat.name_bn : cat.name_en) : t(`categories.${slug}`);
            return (
              <Link
                key={slug}
                to={`/services?category=${slug}`}
                className="group bg-white rounded-2xl p-4 border border-slate-200 hover:border-brand-blue hover:shadow-lg transition flex flex-col items-center text-center gap-3"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-blue group-hover:bg-brand-green group-hover:text-white flex items-center justify-center transition">
                  <CategoryIcon slug={slug} className="w-6 h-6" />
                </div>
                <span className="text-sm font-bold text-slate-800 group-hover:text-brand-blue leading-snug">
                  {title}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Popular Services */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('home.popular_services_title')}</h2>
            <Link to="/services" className="text-brand-blue font-semibold inline-flex items-center gap-1 hover:underline">
              <span>{t('nav.services')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-slate-500 py-8 text-center">{t('home.loading')}</div>
          ) : services.length === 0 ? (
            <div className="text-slate-500 py-8 text-center">{t('home.empty_results')}</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((svc) => (
                <div key={svc.id} className="rounded-2xl border border-slate-200 bg-brand-surface p-5 hover:shadow-md transition flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 text-brand-green text-xs font-bold">
                        <CategoryIcon slug={svc.category_slug} className="w-3.5 h-3.5" />
                        {t(`categories.${svc.category_slug}`)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        {toLocaleDigits(Number(svc.rating).toFixed(1), language)}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {language === 'bn' ? svc.title_bn : svc.title_en}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      {language === 'bn' ? svc.description_bn : svc.description_en}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {language === 'bn' ? svc.area_bn : svc.area_en}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {toLocaleDigits(svc.duration_minutes, language)} {t('home.min_short')}
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 mt-4 border-t border-slate-200 flex items-center justify-between">
                    <div className="text-xl font-extrabold text-brand-green">
                      {formatInr(svc.base_price_inr, language)}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/services/${svc.id}`}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-white"
                      >
                        {t('home.view_details')}
                      </Link>
                      <Link
                        to={`/book/${svc.id}`}
                        className="px-4 py-2 rounded-xl bg-brand-blue text-white text-xs font-bold hover:bg-blue-800"
                      >
                        {t('home.book_now')}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Featured Workers */}
      {workers.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('home.featured_workers_title')}</h2>
            <Link to="/workers" className="text-brand-blue font-semibold inline-flex items-center gap-1 hover:underline">
              <span>{t('nav.workers')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {workers.slice(0, 3).map((w) => (
              <div key={w.id} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-3">
                  {w.photo_url ? (
                    <img src={w.photo_url} alt={w.full_name} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-brand-green text-white font-bold flex items-center justify-center text-lg">
                      {w.full_name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-slate-900 flex items-center gap-1">
                      <span>{w.full_name}</span>
                      <BadgeCheck className="w-4 h-4 text-brand-blue" />
                    </div>
                    <div className="text-xs text-slate-500">
                      {language === 'bn' ? w.service_location_bn : w.service_location_en}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {toLocaleDigits(Number(w.rating_avg).toFixed(1), language)} ({toLocaleDigits(w.reviews_count, language)})
                  </span>
                  <Link to={`/workers/${w.id}`} className="text-brand-blue font-bold hover:underline">
                    {t('home.view_profile')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* How It Works & Why Choose Kajer Manus */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6">
          <h2 className="text-2xl font-extrabold text-slate-900">{t('home.how_it_works_title')}</h2>
          <div className="space-y-4">
            {[
              { title: t('home.step1_title'), desc: t('home.step1_desc') },
              { title: t('home.step2_title'), desc: t('home.step2_desc') },
              { title: t('home.step3_title'), desc: t('home.step3_desc') }
            ].map((step) => (
              <div key={step.title} className="p-4 rounded-2xl bg-brand-surface border border-slate-100">
                <h3 className="font-bold text-brand-blue">{step.title}</h3>
                <p className="text-sm text-slate-600 mt-1">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-brand-green text-white rounded-3xl p-8 space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h2 className="text-2xl font-extrabold">{t('home.why_choose_title')}</h2>
            <ul className="space-y-3">
              {[t('home.why_1'), t('home.why_2'), t('home.why_3'), t('home.why_4')].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                  <span className="text-emerald-50">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white/10 rounded-2xl p-5 border border-white/15 space-y-2">
            <div className="font-bold text-lg">{t('home.app_banner_title')}</div>
            <p className="text-sm text-emerald-100">{t('home.app_banner_desc')}</p>
            <Link
              to="/download-app"
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-bold hover:bg-orange-600 transition"
            >
              <Smartphone className="w-4 h-4" />
              <span>{t('home.cta_download_app')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Customer Testimonials */}
      <section className="bg-white border-y border-slate-200 py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">{t('home.testimonials_title')}</h2>
            <p className="text-slate-600 text-sm sm:text-base">{t('home.testimonials_subtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-200 bg-brand-surface p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <Quote className="w-7 h-7 text-brand-orange/80" />
                  <p className="text-sm text-slate-700 leading-relaxed">{item.quote}</p>
                </div>
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                    <div className="text-xs text-slate-500">{item.area}</div>
                  </div>
                  <div className="flex gap-0.5 text-amber-400">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className="w-3.5 h-3.5 fill-amber-400" />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact / Support CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-4">
        <div className="rounded-3xl bg-brand-blue text-white p-8 md:p-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-2xl font-extrabold">{t('home.contact_cta_title')}</h2>
            <p className="text-blue-100 text-sm sm:text-base">{t('home.contact_cta_desc')}</p>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-orange hover:bg-orange-600 text-white font-bold shadow-lg transition shrink-0"
          >
            <Headphones className="w-5 h-5" />
            <span>{t('home.contact_cta_btn')}</span>
          </Link>
        </div>
      </section>
    </div>
  );
};
