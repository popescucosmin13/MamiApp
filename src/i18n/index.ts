import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ro from '../locales/ro.json';
import en from '../locales/en.json';

const LANGUAGE_KEY = '@mamiapp_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'ro', label: 'Română', nativeLabel: 'Română', shortLabel: 'RO', flag: '🇷🇴' },
  { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN', flag: '🇬🇧' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

export async function getSavedLanguage(): Promise<SupportedLanguage | null> {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved === 'ro' || saved === 'en') return saved;
  } catch {}
  return null;
}

export async function saveLanguage(lang: SupportedLanguage): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
  } catch {}
}

function getDeviceLanguage(): SupportedLanguage {
  try {
    const locales = getLocales();
    const code = locales[0]?.languageCode ?? 'ro';
    if (code === 'en') return 'en';
  } catch {}
  return 'ro';
}

export async function initI18n(): Promise<void> {
  const saved = await getSavedLanguage();
  const lng = saved ?? getDeviceLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      compatibilityJSON: 'v4',
      resources: {
        ro: { translation: ro },
        en: { translation: en },
      },
      lng,
      fallbackLng: 'ro',
      interpolation: { escapeValue: false },
    });
}

export async function changeLanguage(lang: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(lang);
  await saveLanguage(lang);
}

export function getCurrentLanguage(): SupportedLanguage {
  const lang = i18n.language;
  if (lang === 'en') return 'en';
  return 'ro';
}

export default i18n;
