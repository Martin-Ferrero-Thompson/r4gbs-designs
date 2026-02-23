const STORAGE_KEY = 'riding4gbs-theme';
const root = document.documentElement;
const media = window.matchMedia('(prefers-color-scheme: dark)');
function systemTheme() {
    return media.matches ? 'dark' : 'light';
}
function normalize(mode) {
    return mode === 'dark' || mode === 'light' ? mode : 'system';
}
function resolve(mode) {
    return mode === 'system' ? systemTheme() : mode;
}
function apply(mode) {
    const resolved = resolve(mode);
    root.dataset.themeMode = mode;
    root.dataset.theme = resolved;
    root.classList.toggle('theme-dark', resolved === 'dark');
    root.classList.toggle('theme-light', resolved === 'light');
    root.classList.toggle('theme-system', mode === 'system');
}
function getStoredMode() {
    try {
        return localStorage.getItem(STORAGE_KEY) || 'system';
    }
    catch {
        return 'system';
    }
}
function setStoredMode(mode) {
    try {
        localStorage.setItem(STORAGE_KEY, mode);
    }
    catch {
    }
}
const initialMode = normalize(getStoredMode());
apply(initialMode);
function syncSystem() {
    if (getStoredMode() === 'system') {
        apply('system');
        document.dispatchEvent(new CustomEvent('theme:changed', {
            detail: { mode: 'system', theme: resolve('system') }
        }));
    }
}
media.addEventListener('change', syncSystem);
window.__setTheme = function (mode) {
    const next = normalize(mode);
    setStoredMode(next);
    apply(next);
    document.dispatchEvent(new CustomEvent('theme:changed', {
        detail: { mode: next, theme: resolve(next) }
    }));
};
window.__getThemeMode = function () {
    return normalize(getStoredMode());
};
window.__getResolvedTheme = function () {
    return resolve(getStoredMode());
};
