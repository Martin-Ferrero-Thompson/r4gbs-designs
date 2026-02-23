// LanguageSwitcher client logic for Astro
// TypeScript file for full type safety

const LANG_STORAGE_KEY = 'riding4gbs-lang';

function getCurrentLang(): string {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) || 'en';
  } catch {
    return 'en';
  }
}

function setCurrentLang(value: string): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, value);
  } catch {
    // Storage unavailable; continue without persistence
  }
  if ((window as any).__setLang) (window as any).__setLang(value);
}

const flagSVGs: Record<string, string> = {
  en: '<svg class="h-3.5 w-5 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 60 40"><rect width="60" height="40" fill="#012169" rx="2"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#C8102E" stroke-width="4"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#C8102E" stroke-width="6"/></svg>',
  es: '<svg class="h-3.5 w-5 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 60 40"><rect width="60" height="40" fill="#AA151B" rx="2"/><rect y="10" width="60" height="20" fill="#F1BF00"/></svg>',
  eu: '<svg class="h-3.5 w-5 shrink-0 rounded-sm overflow-hidden" viewBox="0 0 60 40"><rect width="60" height="40" fill="#D52B1E" rx="2"/><path d="M0 0L60 40M60 0L0 40" stroke="#39884C" stroke-width="8"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="6"/></svg>',
};

function updateLangUI(root: HTMLElement): void {
  const current = getCurrentLang();
  const currentEl = root.querySelector('[data-lang-current]') as HTMLElement | null;
  if (currentEl) currentEl.textContent = current.toUpperCase();

  const flagEl = root.querySelector('[data-lang-flag]') as HTMLElement | null;
  if (flagEl && current in flagSVGs) flagEl.innerHTML = flagSVGs[current as keyof typeof flagSVGs];

  root.querySelectorAll('[data-lang-option]').forEach((btn) => {
    const code = btn.getAttribute('data-lang-option');
    const isActive = code === current;
    const icon = btn.querySelector('[data-checkmark]') as HTMLElement | null;

    const selectedClasses = (root.dataset.selectedClass || '').split(/\s+/).filter(Boolean);

    if (isActive) {
      btn.classList.add(...selectedClasses);
      btn.classList.remove('opacity-80');
      btn.setAttribute('aria-selected', 'true');
    } else {
      btn.classList.remove(...selectedClasses);
      btn.classList.add('opacity-80');
      btn.setAttribute('aria-selected', 'false');
    }
    if (icon) icon.style.opacity = isActive ? '1' : '0';
  });
}

function closeMenu(root: HTMLElement): void {
  const menu = root.querySelector('[data-lang-menu]') as HTMLElement | null;
  const trigger = root.querySelector('[data-lang-trigger]') as HTMLElement | null;
  if (!menu || !trigger) return;
  menu.classList.add('pointer-events-none', 'opacity-0', 'scale-95');
  trigger.setAttribute('aria-expanded', 'false');
}

function openMenu(root: HTMLElement): void {
  const menu = root.querySelector('[data-lang-menu]') as HTMLElement | null;
  const trigger = root.querySelector('[data-lang-trigger]') as HTMLElement | null;
  if (!menu || !trigger) return;
  document.dispatchEvent(new CustomEvent('dropdown:opened', { detail: { source: 'lang' } }));
  menu.classList.remove('pointer-events-none', 'opacity-0', 'scale-95');
  trigger.setAttribute('aria-expanded', 'true');
}

function setupLanguageDropdown(root: HTMLElement): void {
  const trigger = root.querySelector('[data-lang-trigger]') as HTMLElement | null;
  const menu = root.querySelector('[data-lang-menu]') as HTMLElement | null;
  if (!trigger || !menu) return;

  updateLangUI(root);

  trigger.addEventListener('click', (e: Event) => {
    e.stopPropagation();
    const isOpen = trigger.getAttribute('aria-expanded') === 'true';
    if (isOpen) {
      closeMenu(root);
    } else {
      openMenu(root);
    }
  });

  menu.querySelectorAll('[data-lang-option]').forEach((btn) => {
    btn.addEventListener('click', (e: Event) => {
      e.stopPropagation();
      const code = btn.getAttribute('data-lang-option');
      if (code) {
        setCurrentLang(code);
        updateLangUI(root);
      }
      closeMenu(root);
    });
  });

  document.addEventListener('click', (event: Event) => {
    if (!root.contains(event.target as Node)) closeMenu(root);
  });

  document.addEventListener('keydown', (event: Event) => {
    if ((event as KeyboardEvent).key === 'Escape') closeMenu(root);
  });

  document.addEventListener('dropdown:opened', (event: Event) => {
    const customEvent = event as CustomEvent<{ source: string }>;
    if (customEvent.detail?.source !== 'lang') closeMenu(root);
  });
}

let initialized = false;

export function initLanguageSwitcher(): void {
  if (initialized) return;
  initialized = true;

  document.querySelectorAll('[data-lang-root]').forEach((root) => {
    setupLanguageDropdown(root as HTMLElement);
  });

  document.addEventListener('lang-changed', () => {
    document.querySelectorAll('[data-lang-root]').forEach((root) => updateLangUI(root as HTMLElement));
  });
}

// Auto-init if loaded as a script
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initLanguageSwitcher();
  });
}
