/**
 * i18n Client Script
 * ------------------
 * Handles client-side language switching with lazy loading.
 *
 * Strategy:
 *  - English translations are embedded in the page at build time via
 *    window.__i18n_translations.en (no fetch needed for English).
 *  - Spanish (es) and Basque (eu) are fetched on-demand from /i18n/{lang}.json
 *    the first time the user selects that language, then cached in memory.
 *  - On initial page load, if the stored language is non-English, the file is
 *    fetched before content is revealed to avoid a flash of English text.
 *
 * Usage in HTML:
 *   <p data-i18n="nav.challenge">The Challenge</p>
 *   <p data-i18n-html="donate.supportNote">HTML content here</p>
 */

(function initI18n() {
  const STORAGE_KEY = 'riding4gbs-lang';
  const DEFAULT_LANG = 'en';

  // English translations are injected at build time via Astro's define:vars.
  // Non-English data is fetched on demand and stored here.
  const translationCache: Record<string, Record<string, any>> =
    (window as any).__i18n_translations || {};

  function getNestedValue(obj: Record<string, any>, key: string): string | undefined {
    return key.split('.').reduce((acc, part) => acc?.[part], obj) as unknown as string | undefined;
  }

  function getCurrentLang(): string {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  }

  /** Apply translations for the given language from the in-memory cache. */
  function applyTranslations(lang: string) {
    const langData = translationCache[lang] || translationCache[DEFAULT_LANG];
    if (!langData) return;

    // data-i18n → textContent replacement
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translationCache[DEFAULT_LANG], key);
      if (value !== undefined) el.textContent = value;
    });

    // data-i18n-html → innerHTML replacement (for content containing links)
    document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translationCache[DEFAULT_LANG], key);
      if (value !== undefined) el.innerHTML = value;
    });

    // data-i18n-placeholder → input placeholder replacement
    document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translationCache[DEFAULT_LANG], key);
      if (value !== undefined) el.placeholder = value;
    });
  }

  function updateActiveButtons(lang: string) {
    document.querySelectorAll<HTMLElement>('#lang-switcher').forEach((switcher) => {
      const activeClasses = (switcher.dataset.activeClasses || '').split(/\s+/).filter(Boolean);
      const inactiveClasses = (switcher.dataset.inactiveClasses || '').split(/\s+/).filter(Boolean);

      switcher.querySelectorAll<HTMLElement>('[data-lang-btn]').forEach((btn) => {
        const btnLang = btn.getAttribute('data-lang-btn');
        if (btnLang === lang) {
          btn.classList.remove(...inactiveClasses);
          btn.classList.add(...activeClasses);
        } else {
          btn.classList.remove(...activeClasses);
          btn.classList.add(...inactiveClasses);
        }
      });
    });
  }

  /**
   * Fetch a language file from /i18n/{lang}.json, cache it, and return it.
   * Returns the cached object immediately if already fetched.
   */
  async function loadLang(lang: string): Promise<Record<string, any> | null> {
    if (translationCache[lang]) return translationCache[lang];
    try {
      const res = await fetch(`/i18n/${lang}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      translationCache[lang] = data;
      return data;
    } catch (e) {
      console.warn(`[i18n] Failed to load language "${lang}":`, e);
      return null;
    }
  }

  /**
   * Switch the active language. For English, applies immediately from cache.
   * For other languages, fetches the file first (or uses cache on repeat calls).
   */
  async function setLang(lang: string) {
    if (lang !== DEFAULT_LANG) {
      await loadLang(lang);
    }
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
    updateActiveButtons(lang);
    document.documentElement.lang = lang;
    document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
  }

  // Expose globals so LanguageSwitcher and other components can call them
  (window as any).__setLang = setLang;
  (window as any).__getCurrentLang = getCurrentLang;

  // --- Initial page load ---
  const currentLang = getCurrentLang();

  if (currentLang === DEFAULT_LANG) {
    // English: translations are already in the page — apply synchronously
    applyTranslations(currentLang);
    updateActiveButtons(currentLang);
    document.documentElement.lang = currentLang;
    document.documentElement.classList.remove('i18n-loading');
  } else {
    // Non-English: fetch then apply, keeping content hidden until ready
    loadLang(currentLang).then(() => {
      applyTranslations(currentLang);
      updateActiveButtons(currentLang);
      document.documentElement.lang = currentLang;
      document.documentElement.classList.remove('i18n-loading');
    });
  }
})();
