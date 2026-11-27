import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone } from 'lucide-react';
import { apiRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export const AboutPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('nav.about')}</h1>
        <p className="text-slate-700 leading-relaxed">
          {language === 'bn'
            ? 'কাজের মানুষ (Kajer Manus) হলো পশ্চিমবঙ্গের একটি নির্ভরযোগ্য ও আধুনিক গৃহপরিষেবা প্ল্যাটফর্ম, যা গ্রাহকদের সাথে যাচাইকৃত ও দক্ষ কারিগরদের সরাসরি যুক্ত করে।'
            : 'Kajer Manus is West Bengal’s trusted home-service marketplace connecting households and businesses with admin-verified skilled professionals.'}
        </p>
      </div>
    </div>
  );
};

export const ContactPage: React.FC = () => {
  const { t } = useTranslation();
  const { user, language } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await apiRequest('/support/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, subject, message, languageCode: language })
      });
      setSent(true);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-5">
        <h1 className="text-3xl font-extrabold text-slate-900">{t('nav.contact')}</h1>
        {sent && (
          <div className="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-semibold">
            {language === 'bn' ? 'আপনার বার্তা সফলভাবে পাঠানো হয়েছে!' : 'Your message has been submitted!'}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.full_name')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.email')} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={language === 'bn' ? 'বিষয়' : 'Subject'} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder={language === 'bn' ? 'আপনার বার্তা লিখুন' : 'Your message'} required className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm" />
          {error && <div className="p-3 rounded-xl bg-red-50 text-red-700 text-sm">{error}</div>}
          <button type="submit" className="w-full py-3 rounded-xl bg-brand-blue text-white font-bold">
            {language === 'bn' ? 'বার্তা পাঠান' : 'Send Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export const PolicyPage: React.FC<{ type: 'privacy' | 'terms' | 'cancellation' }> = ({ type }) => {
  const { t } = useTranslation();
  const { language } = useAuth();
  const titleKey = type === 'privacy' ? 'nav.privacy' : type === 'terms' ? 'nav.terms' : 'nav.cancellation';

  const body =
    type === 'privacy'
      ? language === 'bn'
        ? 'কাজের মানুষ আপনার নাম, ইমেল, মোবাইল নম্বর এবং ঠিকানা শুধুমাত্র বুকিং সমন্বয় ও নিরাপত্তার জন্য সংরক্ষণ করে। আমরা তৃতীয় পক্ষের কাছে আপনার ব্যক্তিগত তথ্য বিক্রি করি না।'
        : 'Kajer Manus securely stores your name, email, mobile number, and service address exclusively to fulfill home service bookings and account notifications.'
      : type === 'terms'
      ? language === 'bn'
        ? 'বুকিং করার সময় সঠিক ঠিকানা ও যোগাযোগের তথ্য প্রদান করুন। সমস্ত সেবা প্রদানকারী অ্যাডমিন যাচাইকরণের পর যুক্ত হন।'
        : 'Please provide accurate contact details and service addresses when booking. Providers are subject to admin approval before accepting public requests.'
      : language === 'bn'
      ? 'অপেক্ষমান (Pending) বা গৃহীত (Accepted) বুকিং কাজ শুরু হওয়ার আগে বিনামূল্যে বাতিল করা যাবে। কাজ শুরু হওয়ার পর বাতিলের জন্য সহায়তায় যোগাযোগ করুন।'
      : 'Customers may cancel pending or accepted bookings before work begins with zero cancellation penalty. Once work is in progress, please contact support.';

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-4">
        <h1 className="text-3xl font-extrabold text-slate-900">{t(titleKey)}</h1>
        <p className="text-slate-700 leading-relaxed">{body}</p>
      </div>
    </div>
  );
};

export const DownloadAppPage: React.FC = () => {
  const { t } = useTranslation();
  const { language } = useAuth();
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="bg-brand-green text-white rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
        <img src="/logo.jpg" alt={t('brand.name')} className="w-28 h-28 rounded-3xl object-cover shadow-xl ring-4 ring-white/25" />
        <div className="space-y-4">
          <h1 className="text-3xl font-extrabold">{t('home.app_banner_title')}</h1>
          <p className="text-emerald-100">{t('home.app_banner_desc')}</p>
          <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand-orange text-white font-bold">
            <Smartphone className="w-5 h-5" />
            <span>{language === 'bn' ? 'প্যাকেজ: in.kajermanus.app' : 'Android Package: in.kajermanus.app'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
