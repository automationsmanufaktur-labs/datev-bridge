/**
 * Date helpers. To stay timezone-stable across machines, calendar dates are
 * represented as UTC-midnight Date objects and always formatted via UTC getters.
 */

/**
 * Parse a source timestamp into a UTC-midnight Date of its calendar day.
 * Accepts the common Stripe formats "2026-01-15 14:30:00" and ISO
 * "2026-01-15T14:30:00Z" by extracting the YYYY-MM-DD part directly, which
 * avoids any local-timezone shifting. Falls back to Date parsing otherwise.
 */
export function parseCalendarDate(value: string): Date {
  const m = /(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Cannot parse date: "${value}"`);
  }
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

/** Format a date as TTMM (DATEV Belegdatum, year is implied by the fiscal year). */
export function formatTTMM(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}${mm}`;
}

/** Format a date as JJJJMMTT (DATEV header dates). */
export function formatJJJJMMTT(date: Date): string {
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

/** Format a timestamp as JJJJMMTTHHMMSSFFF (DATEV header "erzeugt am"). */
export function formatTimestamp(date: Date): string {
  const base = formatJJJJMMTT(date);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${base}${hh}${mi}${ss}000`;
}
