import { parse } from 'csv-parse/sync';
import type { SourceAdapter } from './types';
import type { NormalizedTransaction, TxCategory } from '../model/transaction';
import { parseAmountToCents } from '../util/money';
import { parseCalendarDate } from '../util/date';

/**
 * Adapter for Stripe's "Balance change from activity / Itemized" CSV export
 * (https://docs.stripe.com/reports/report-types/balance). That report is the
 * right source for full bookkeeping because it lists every money movement
 * (charges, fees, refunds, payouts) — Stripe behaves like a bank account.
 *
 * We parse the CSV (no API key needed) rather than the Stripe API, which is the
 * deliberate difference from existing tools.
 */

/** Column-name aliases tolerated across Stripe export versions (v6/v7). */
const HEADER_ALIASES: Record<string, string> = {
  'balance_transaction_id': 'id',
  'id': 'id',
  'created': 'created',
  'created_utc': 'created',
  'created (utc)': 'created',
  'reporting_category': 'reporting_category',
  'type': 'type',
  'gross': 'gross',
  'fee': 'fee',
  'net': 'net',
  'currency': 'currency',
  'description': 'description',
  'automatic_payout_id': 'payout_id',
  'payout_id': 'payout_id',
};

function normalizeHeader(header: string): string {
  const key = header.trim().toLowerCase();
  return HEADER_ALIASES[key] ?? key;
}

/** Map Stripe's reporting_category (or legacy `type`) onto our category set. */
function classify(reportingCategory: string, legacyType: string): TxCategory {
  const value = (reportingCategory || legacyType).trim().toLowerCase();
  switch (value) {
    case 'charge':
    case 'payment':
      return 'charge';
    case 'refund':
    case 'partial_refund':
    case 'payment_refund':
      return 'refund';
    case 'payout':
      return 'payout';
    case 'fee':
    case 'stripe_fee':
    case 'network_cost':
      return 'fee';
    case 'dispute':
    case 'adjustment':
    case 'reserve':
    case 'contribution':
      return 'adjustment';
    default:
      return 'other';
  }
}

function field(row: Record<string, string>, key: string): string {
  return row[key]?.trim() ?? '';
}

export const stripeAdapter: SourceAdapter = {
  id: 'stripe',
  name: 'Stripe (Balance change / Itemized CSV)',

  parse(csv: string): NormalizedTransaction[] {
    const records = parse(csv, {
      columns: (headers: string[]) => headers.map(normalizeHeader),
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    }) as Record<string, string>[];

    const transactions: NormalizedTransaction[] = [];

    for (const [index, row] of records.entries()) {
      const id = field(row, 'id');
      const created = field(row, 'created');
      if (id === '' && created === '') {
        continue; // tolerate stray blank rows
      }
      if (created === '') {
        throw new Error(`Stripe row ${index + 1}: missing "created" date (id="${id}")`);
      }

      const currency = field(row, 'currency').toUpperCase() || 'EUR';
      const grossCents = parseAmountToCents(field(row, 'gross') || '0');
      const feeCents = parseAmountToCents(field(row, 'fee') || '0');
      const netRaw = field(row, 'net');
      const netCents = netRaw !== '' ? parseAmountToCents(netRaw) : grossCents - feeCents;

      const description = field(row, 'description');
      const payoutId = field(row, 'payout_id');

      const tx: NormalizedTransaction = {
        id: id || `row-${index + 1}`,
        date: parseCalendarDate(created),
        category: classify(field(row, 'reporting_category'), field(row, 'type')),
        grossCents,
        feeCents,
        netCents,
        currency,
        raw: row,
      };
      if (description !== '') tx.description = description;
      if (payoutId !== '') tx.payoutId = payoutId;

      transactions.push(tx);
    }

    return transactions;
  },
};
