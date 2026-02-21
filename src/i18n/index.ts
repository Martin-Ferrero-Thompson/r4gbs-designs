/**
 * i18n Configuration
 * ------------------
 * Supported languages, default language, and server-side helper functions.
 *
 * Only English is bundled at build time. Spanish (es) and Basque (eu)
 * translation files are served as static assets from /public/i18n/ and
 * fetched on-demand by the client when the user switches language.
 */

import en from './translations/en.json';

export const defaultLang = 'en' as const;
export const languages = ['en', 'es', 'eu'] as const;
export type Lang = (typeof languages)[number];

export const languageNames: Record<Lang, string> = {
  en: 'EN',
  es: 'ES',
  eu: 'EU',
};

/** English-only translations used server-side when rendering pages. */
export const translations = { en };

/**
 * Get a nested value from an object using dot-notation key.
 * e.g. getNestedValue(obj, 'nav.challenge') => obj.nav.challenge
 */
function getNestedValue(obj: Record<string, any>, key: string): string | undefined {
  return key.split('.').reduce((acc, part) => acc?.[part], obj) as string | undefined;
}

/**
 * Render a translation string for the given language.
 * Since only 'en' is bundled server-side, this is always called with defaultLang.
 * Falls back to the key itself if the value is missing.
 */
export function t(lang: Lang, key: string): string {
  const langData = (translations as Record<string, any>)[lang] ?? translations[defaultLang];
  return getNestedValue(langData, key)
    ?? getNestedValue(translations[defaultLang], key)
    ?? key;
}

/**
 * Returns the English translations to embed into the page at build time.
 * The client uses this data when the user switches back to English (no fetch needed).
 * Non-English languages are loaded on-demand via fetch('/i18n/{lang}.json').
 */
export function getDefaultTranslations() {
  return translations;
}
