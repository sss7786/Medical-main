import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

function normalizeStoredLanguage(raw: string | null): 'zh' | 'en' {
  if (!raw) return 'zh';
  const lower = raw.trim().toLowerCase();
  if (lower.startsWith('zh')) return 'zh';
  if (lower.startsWith('en')) return 'en';
  return 'zh';
}

function readStoredLanguage(): 'zh' | 'en' {
  try {
    return normalizeStoredLanguage(localStorage.getItem('language'));
  } catch {
    return 'zh';
  }
}

const initialLng = readStoredLanguage();
try {
  if (localStorage.getItem('language') !== initialLng) {
    localStorage.setItem('language', initialLng);
  }
} catch { /* private mode */ }

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en }
    },
    lng: initialLng,
    fallbackLng: 'zh',
    supportedLngs: ['zh', 'en'],
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
