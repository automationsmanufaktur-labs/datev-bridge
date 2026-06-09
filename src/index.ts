/**
 * Library entry point. The CLI is a thin wrapper around `convert`.
 *
 * datev-bridge is format-compatible with the DATEV EXTF Buchungsstapel import.
 * It is NOT a DATEV product, is not DATEV-certified, and makes no GoBD
 * guarantee. Always have the result checked by your tax advisor.
 */

import { getAdapter } from './adapters';
import { resolveConfig, type ConfigOverrides, type MappingConfig } from './mapping/config';
import { mapTransactions } from './mapping/engine';
import { writeExtf } from './writer/extf';
import type { NormalizedTransaction, TxCategory } from './model/transaction';
import type { BookingRow } from './model/booking';

export interface ConvertOptions {
  /** Raw source CSV content (UTF-8). */
  csv: string;
  /** Source adapter id. Default: 'stripe'. */
  adapterId?: string;
  /** User mapping config (already parsed object); merged onto the SKR preset. */
  config?: unknown;
  /** CLI-style overrides applied last (skr, berater/mandant, label). */
  overrides?: ConfigOverrides;
  /** Timestamp for the EXTF "erzeugt am" header. Default: now. */
  generatedAt?: Date;
}

export interface ConvertSummary {
  /** Count of source transactions per category. */
  byCategory: Partial<Record<TxCategory, number>>;
  /** Sum of all booking amounts on the debit (Soll) side, in cents. */
  totalDebitCents: number;
  /** Sum of all booking amounts on the credit (Haben) side, in cents. */
  totalCreditCents: number;
  /** True if debits equal credits (double-entry invariant). */
  balanced: boolean;
}

export interface ConvertResult {
  /** Encoded EXTF bytes (CP-1252, CRLF) — write to disk as-is. */
  buffer: Buffer;
  /** EXTF content as a string (for inspection). */
  text: string;
  /** The semantic booking rows that were written (handy for library users). */
  bookings: BookingRow[];
  /** Number of DATEV booking rows written. */
  bookingCount: number;
  /** Number of source transactions parsed. */
  transactionCount: number;
  /** Number of transactions skipped (unsupported category). */
  skipped: number;
  /** Non-fatal warnings collected during mapping. */
  warnings: string[];
  /** Aggregates for a trustworthy CLI/UI summary. */
  summary: ConvertSummary;
  /** The effective, validated config that was used. */
  config: MappingConfig;
}

function summarize(
  transactions: NormalizedTransaction[],
  bookings: BookingRow[],
): ConvertSummary {
  const byCategory: Partial<Record<TxCategory, number>> = {};
  for (const tx of transactions) {
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + 1;
  }
  let totalDebitCents = 0;
  let totalCreditCents = 0;
  for (const booking of bookings) {
    // Each booking debits `account` (or its contra) and credits the other side
    // by the same amount, so both totals accumulate the booking amount once.
    totalDebitCents += booking.amountCents;
    totalCreditCents += booking.amountCents;
  }
  return {
    byCategory,
    totalDebitCents,
    totalCreditCents,
    balanced: totalDebitCents === totalCreditCents,
  };
}

export function convert(options: ConvertOptions): ConvertResult {
  const adapter = getAdapter(options.adapterId ?? 'stripe');
  const config = resolveConfig(options.config, options.overrides ?? {});

  const transactions = adapter.parse(options.csv);
  const { bookings, warnings, skipped } = mapTransactions(transactions, config);

  const generatedAt = options.generatedAt ?? new Date();
  const { buffer, text, bookingCount } = writeExtf(bookings, config, { generatedAt });

  return {
    buffer,
    text,
    bookings,
    bookingCount,
    transactionCount: transactions.length,
    skipped,
    warnings,
    summary: summarize(transactions, bookings),
    config,
  };
}

export { getAdapter, listAdapters } from './adapters';
export type { SourceAdapter } from './adapters/types';
export type { NormalizedTransaction, TxCategory } from './model/transaction';
export type { BookingRow } from './model/booking';
export {
  resolveConfig,
  loadConfigFromYaml,
  MappingConfigSchema,
  PRESET_SKR03,
  PRESET_SKR04,
  type MappingConfig,
  type ConfigOverrides,
} from './mapping/config';
export { mapTransactions, type MappingResult } from './mapping/engine';
export { writeExtf, type ExtfWriteResult } from './writer/extf';
export { encodeCp1252 } from './writer/encoding';
