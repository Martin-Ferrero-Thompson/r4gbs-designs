/**
 * i18n Configuration
 * ------------------
 * Supported languages, default language, and helper functions.
 * All translations are bundled at build time — no runtime service needed.
 */

import en from './translations/en.json';
import es from './translations/es.json';
import eu from './translations/eu.json';

export const defaultLang = 'en' as const;
export const languages = ['en', 'es', 'eu'] as const;
export type Lang = (typeof languages)[number];

export const languageNames: Record<Lang, string> = {
  en: 'EN',
  es: 'ES',
  eu: 'EU',
};

export const translations: Record<Lang, typeof en> = { en, es, eu };

/**
 * Get a nested value from an object using dot-notation key.
 * e.g. getNestedValue(obj, 'nav.challenge') => obj.nav.challenge
 */
function getNestedValue(obj: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce((acc, part) => acc?.[part], obj) as string | undefined;
}

/**
 * Create a translation function for a specific language.
 * Falls back to English if a key is missing in the target language.
 */
export function t(lang: Lang, key: string): string {
  return getNestedValue(translations[lang], key)
    ?? getNestedValue(translations[defaultLang], key)
    ?? key;
}

/**
 * Get all translations as a serializable object for embedding in pages.
 */
export function getAllTranslations() {
  return translations;
}
