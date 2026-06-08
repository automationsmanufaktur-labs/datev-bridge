/**
 * Source-independent transaction model. Every adapter normalizes its source CSV
 * into these objects so the mapping engine and EXTF writer never need to know
 * which payment provider the data came from.
 *
 * Money is stored as integer minor units (cents) to avoid floating-point errors
 * in accounting math. Formatting back to "1234,56" happens only at write time.
 */

export const TX_CATEGORIES = [
  'charge',
  'refund',
  'payout',
  'fee',
  'adjustment',
  'other',
] as const;

export type TxCategory = (typeof TX_CATEGORIES)[number];

export interface NormalizedTransaction {
  /** Source-unique id, e.g. Stripe `balance_transaction_id` (txn_…). */
  id: string;
  /**
   * Booking-relevant calendar date. Day precision is what DATEV stores
   * (Belegdatum = TTMM), so this is normalized to UTC midnight of the
   * transaction's calendar day to stay timezone-stable.
   */
  date: Date;
  category: TxCategory;
  /** Gross amount in integer minor units. Signed as in the source. */
  grossCents: number;
  /** Processing fee in integer minor units. Usually >= 0. */
  feeCents: number;
  /** Net = gross - fee, integer minor units. */
  netCents: number;
  /** ISO 4217 currency, upper-case (e.g. EUR). */
  currency: string;
  /** Free-text description from the source, if any. */
  description?: string;
  /** Links a charge/refund to its payout batch (Stripe automatic_payout_id). */
  payoutId?: string;
  /** Original source row, kept for traceability and debugging. */
  raw: Record<string, string>;
}
