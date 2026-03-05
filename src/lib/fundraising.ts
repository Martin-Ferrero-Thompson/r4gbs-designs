/**
 * Fundraising Data — Single source of truth
 * ──────────────────────────────────────────
 * All numeric fundraising targets and current totals live here.
 * When a donation platform is integrated, replace the static
 * `raised` values with API-fetched data in this one file.
 */

export interface CharityData {
  target: number;
  raised: number;
  currency: string;
  locale: string;
}

export const charities = {
  uk: {
    target: 10_000,
    raised: 0,
    currency: 'GBP',
    locale: 'en-GB',
  },
  es: {
    target: 10_000,
    raised: 0,
    currency: 'EUR',
    locale: 'es-ES',
  },
} as const satisfies Record<string, CharityData>;

export type CharityKey = keyof typeof charities;

/** Percentage progress clamped to 0–100. */
export function getProgress(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(Math.round((raised / target) * 100), 100);
}

/** Format a currency amount for display (e.g. "£10,000"). */
export function formatCurrency(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
