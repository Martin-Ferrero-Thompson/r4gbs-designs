// Theme client logic for Astro
// TypeScript file for full type safety

const STORAGE_KEY = 'riding4gbs-theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');

function systemTheme(): string {
  return media.matches ? 'dark' : 'light';
}

function normalize(mode: string): string {
  return mode === 'dark' || mode === 'light' ? mode : 'system';
}

function resolve(mode: string): string {
  return mode === 'system' ? systemTheme() : mode;
}

function apply(mode: string): void {
  const resolved = resolve(mode);
  root.dataset.themeMode = mode;
  root.dataset.theme = resolved;
  root.classList.toggle('theme-dark', resolved === 'dark');
  root.classList.toggle('theme-light', resolved === 'light');
  root.classList.toggle('theme-system', mode === 'system');
}

function getStoredMode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'system';
  } catch {
    return 'system';
  }
}

function setStoredMode(mode: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable; continue without persistence
  }
}

const initialMode = normalize(getStoredMode());
apply(initialMode);

function syncSystem(): void {
  if ((localStorage.getItem(STORAGE_KEY) || 'system') === 'system') {
    apply('system');
    document.dispatchEvent(new CustomEvent('theme:changed', {
      detail: { mode: 'system', theme: resolve('system') }
    }));
  }
}

media.addEventListener('change', syncSystem);

(window as any).__setTheme = function(mode: string) {
  const next = normalize(mode);
  setStoredMode(next);
  apply(next);
  document.dispatchEvent(new CustomEvent('theme:changed', {
    detail: { mode: next, theme: resolve(next) }
  }));
};


(window as any).__getThemeMode = function() {
  return normalize(getStoredMode());
};

(window as any).__getResolvedTheme = function() {
  return resolve(getStoredMode());
};
