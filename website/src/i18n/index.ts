import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import bnTranslation from '../locales/bn/translation.json';
import enTranslation from '../locales/en/translation.json';

const STORAGE_KEY = 'km_language';

const savedLang = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
const initialLang = savedLang === 'en' ? 'en' : 'bn';

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLang;
}

i18n.use(initReactI18next).init({
  resources: {
    bn: { translation: bnTranslation },
    en: { translation: enTranslation }
  },
  lng: initialLang,
  fallbackLng: 'bn',
  interpolation: {
    escapeValue: false
  }
});

export function setDocumentLanguage(lang: 'bn' | 'en') {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, lang);
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
  }
  return i18n.changeLanguage(lang);
}

export default i18n;
