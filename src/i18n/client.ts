/**
 * i18n Client Script
 * ------------------
 * Handles client-side language switching. Bundled into every page.
 * Reads language preference from localStorage and swaps text content
 * on elements with data-i18n attributes.
 *
 * Usage in HTML:
 *   <p data-i18n="nav.challenge">The Challenge</p>
 *   <p data-i18n-html="donate.supportNote">HTML content here</p>
 */

(function initI18n() {
  const STORAGE_KEY = 'riding4gbs-lang';
  const DEFAULT_LANG = 'en';

  // Translations are injected at build time via Astro's define:vars
  // They will be available as window.__i18n_translations
  const translations: Record<string, Record<string, any>> =
    (window as any).__i18n_translations || {};

  function getNestedValue(obj: Record<string, any>, key: string): string | undefined {
    return key.split('.').reduce((acc, part) => acc?.[part], obj) as unknown as string | undefined;
  }

  function getCurrentLang(): string {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
  }

  function setLang(lang: string) {
    localStorage.setItem(STORAGE_KEY, lang);
    applyTranslations(lang);
    updateActiveButtons(lang);
    document.documentElement.lang = lang;
    // Dispatch custom event for React components (e.g., Countdown)
    document.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
  }

  function applyTranslations(lang: string) {
    const langData = translations[lang] || translations[DEFAULT_LANG];
    if (!langData) return;

    // Handle data-i18n (textContent replacement)
    document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translations[DEFAULT_LANG], key);
      if (value !== undefined) {
        el.textContent = value;
      }
    });

    // Handle data-i18n-html (innerHTML replacement — for content with links)
    document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translations[DEFAULT_LANG], key);
      if (value !== undefined) {
        el.innerHTML = value;
      }
    });

    // Handle data-i18n-placeholder (for inputs)
    document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const value = getNestedValue(langData, key)
        ?? getNestedValue(translations[DEFAULT_LANG], key);
      if (value !== undefined) {
        el.placeholder = value;
      }
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

  // Expose setLang globally so the language switcher buttons can call it
  (window as any).__setLang = setLang;
  (window as any).__getCurrentLang = getCurrentLang;

  // Apply on initial page load
  const currentLang = getCurrentLang();
  // Always apply translations to ensure correct language is shown
  applyTranslations(currentLang);
  updateActiveButtons(currentLang);
  document.documentElement.lang = currentLang;

  // Remove loading class to reveal translated content (prevents flash of wrong language)
  document.documentElement.classList.remove('i18n-loading');
})();
