import React, { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, LogOut, Menu, ShieldCheck, Smartphone, User as UserIcon, Wrench, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Layout: React.FC = () => {
  const { t } = useTranslation();
  const { user, language, switchLanguage, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition ${
      isActive ? 'bg-blue-50 text-brand-blue font-semibold' : 'text-slate-700 hover:bg-slate-100'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-brand-surface">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <img
              src="/logo.png"
              alt={t('brand.name')}
              className="w-10 h-10 rounded-xl object-contain bg-white ring-1 ring-slate-200"
            />
            <div>
              <div className="text-lg font-extrabold text-brand-green leading-tight">{t('brand.name')}</div>
              <div className="text-[11px] font-semibold text-brand-blue tracking-wide">{t('brand.subtitle')}</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            <NavLink to="/" className={navClass}>{t('nav.home')}</NavLink>
            <NavLink to="/services" className={navClass}>{t('nav.services')}</NavLink>
            <NavLink to="/workers" className={navClass}>{t('nav.workers')}</NavLink>
            <NavLink to="/about" className={navClass}>{t('nav.about')}</NavLink>
            <NavLink to="/download-app" className={navClass}>{t('nav.download_app')}</NavLink>
            <NavLink to="/contact" className={navClass}>{t('nav.contact')}</NavLink>
          </nav>

          <div className="flex items-center gap-2">
            {/* Bilingual Language Switcher */}
            <div
              className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200"
              role="group"
              aria-label="Language switcher"
            >
              <Globe className="w-4 h-4 text-brand-blue ml-2 mr-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => switchLanguage('bn')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  language === 'bn' ? 'bg-brand-green text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => switchLanguage('en')}
                className={`px-2.5 py-1 rounded-full text-xs font-bold transition ${
                  language === 'en' ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                English
              </button>
            </div>

            {user ? (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to={
                    user.role === 'admin'
                      ? '/admin'
                      : user.role === 'provider'
                      ? '/provider/dashboard'
                      : '/dashboard'
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold hover:bg-emerald-800 transition"
                >
                  {user.role === 'admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : user.role === 'provider' ? (
                    <Wrench className="w-4 h-4" />
                  ) : (
                    <UserIcon className="w-4 h-4" />
                  )}
                  <span>{user.full_name.split(' ')[0]}</span>
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 transition"
                  title={t('nav.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Link
                  to="/login"
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold text-brand-blue hover:bg-blue-50 transition"
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-orange text-white hover:bg-orange-600 shadow-sm transition"
                >
                  {t('nav.register')}
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="lg:hidden p-2 rounded-xl border border-slate-200 text-slate-700"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-2">
            <div className="flex flex-col gap-1">
              <NavLink to="/" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.home')}</NavLink>
              <NavLink to="/services" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.services')}</NavLink>
              <NavLink to="/workers" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.workers')}</NavLink>
              <NavLink to="/about" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.about')}</NavLink>
              <NavLink to="/download-app" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.download_app')}</NavLink>
              <NavLink to="/contact" onClick={() => setMobileOpen(false)} className={navClass}>{t('nav.contact')}</NavLink>
            </div>
            <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
              {user ? (
                <>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2 rounded-xl bg-brand-green text-white text-sm font-semibold"
                  >
                    {t('nav.dashboard')}
                  </Link>
                  {user.role === 'provider' && (
                    <Link
                      to="/provider/dashboard"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center px-4 py-2 rounded-xl bg-brand-blue text-white text-sm font-semibold"
                    >
                      {t('nav.provider_dashboard')}
                    </Link>
                  )}
                  {user.role === 'admin' && (
                    <Link
                      to="/admin"
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 text-center px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold"
                    >
                      {t('nav.admin_dashboard')}
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      logout();
                    }}
                    className="w-full px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold"
                  >
                    {t('nav.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2 rounded-xl border border-brand-blue text-brand-blue text-sm font-semibold"
                  >
                    {t('nav.login')}
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center px-4 py-2 rounded-xl bg-brand-orange text-white text-sm font-semibold"
                  >
                    {t('nav.register')}
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="bg-slate-900 text-slate-300 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt={t('brand.name')} className="w-10 h-10 rounded-xl object-contain bg-white" />
              <div>
                <div className="font-bold text-white text-lg">{t('brand.name')}</div>
                <div className="text-xs text-emerald-400">{t('brand.tagline')}</div>
              </div>
            </div>
            <p className="text-sm text-slate-400">{t('home.hero_description')}</p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.quick_links')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/services" className="hover:text-white">{t('nav.services')}</Link></li>
              <li><Link to="/workers" className="hover:text-white">{t('nav.workers')}</Link></li>
              <li><Link to="/about" className="hover:text-white">{t('nav.about')}</Link></li>
              <li><Link to="/download-app" className="hover:text-white inline-flex items-center gap-1"><Smartphone className="w-4 h-4" />{t('nav.download_app')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.legal')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/privacy-policy" className="hover:text-white">{t('nav.privacy')}</Link></li>
              <li><Link to="/terms" className="hover:text-white">{t('nav.terms')}</Link></li>
              <li><Link to="/cancellation-policy" className="hover:text-white">{t('nav.cancellation')}</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-3">{t('footer.support')}</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/contact" className="hover:text-white">{t('nav.contact')}</Link></li>
              <li>support@kajermanus.in</li>
              <li>https://www.kajermanus.in</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-5 text-center text-xs text-slate-400">
          {t('footer.rights')}
        </div>
      </footer>
    </div>
  );
};
