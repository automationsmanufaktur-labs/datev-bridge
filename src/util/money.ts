/**
 * Money helpers. All internal amounts are integer minor units (cents) to keep
 * accounting math exact; we never divide by 100 in floating point.
 */

/**
 * Parse a decimal amount string (dot as decimal separator, e.g. "1234.56",
 * "12", "-2.50", ".5") into integer minor units. Two-decimal currencies only
 * (EUR); a third decimal is rounded half-up. Thousands separators are rejected
 * because Stripe CSV exports never use them — silently accepting them would
 * risk misreading "1.234" as 1,23.
 */
export function parseAmountToCents(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') return 0;

  const negative = trimmed.startsWith('-');
  const unsigned = trimmed.replace(/^[+-]/, '');

  if (!/^\d*\.?\d*$/.test(unsigned) || unsigned === '' || unsigned === '.') {
    throw new Error(`Cannot parse amount: "${value}"`);
  }

  const dot = unsigned.indexOf('.');
  const intPart = dot === -1 ? unsigned : unsigned.slice(0, dot);
  const fracPart = dot === -1 ? '' : unsigned.slice(dot + 1);

  let cents = Number(intPart || '0') * 100;
  if (fracPart.length > 0) {
    const frac2 = fracPart.slice(0, 2).padEnd(2, '0');
    cents += Number(frac2);
    if (fracPart.length > 2 && Number(fracPart[2]) >= 5) {
      cents += 1;
    }
  }

  return negative ? -cents : cents;
}

/**
 * Format integer minor units into the German decimal notation DATEV expects:
 * comma decimal separator, exactly two decimals, no thousands separator.
 * e.g. 119_00 -> "119,00", -250 -> "-2,50".
 */
export function formatCentsDe(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rem = abs % 100;
  return `${negative ? '-' : ''}${euros},${String(rem).padStart(2, '0')}`;
}
