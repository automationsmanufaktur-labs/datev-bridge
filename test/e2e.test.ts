import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { convert } from '../src/index';
import type { BookingRow } from '../src/model/booking';

const fixture = readFileSync(
  new URL('../fixtures/stripe-balance-sample.csv', import.meta.url),
  'utf8',
);

const GELDTRANSIT = 1360;

/** Signed effect of a booking on the Geldtransit account (debit-positive). */
function transitDelta(booking: BookingRow): number {
  if (booking.contraAccount === GELDTRANSIT) {
    return booking.debitCredit === 'H' ? booking.amountCents : -booking.amountCents;
  }
  if (booking.account === GELDTRANSIT) {
    return booking.debitCredit === 'S' ? booking.amountCents : -booking.amountCents;
  }
  return 0;
}

describe('convert (Stripe fixture → EXTF)', () => {
  const result = convert({
    csv: fixture,
    generatedAt: new Date('2026-02-01T10:25:00Z'),
    overrides: { beraterNr: 4711, mandantNr: 222 },
  });

  it('produces bookings from all 5 transactions', () => {
    expect(result.transactionCount).toBe(5);
    // 2 charges (revenue + fee each = 4) + 1 refund + 1 standalone fee + 1 payout = 7
    expect(result.bookingCount).toBe(7);
    expect(result.skipped).toBe(0);
  });

  it('emits a structurally valid EXTF file', () => {
    const lines = result.text.split('\r\n').filter((l) => l !== '');
    expect(lines).toHaveLength(2 + 7); // 2 header lines + 7 bookings
    expect(lines[0]!.split(';')).toHaveLength(31);
    expect(lines[1]!.split(';')).toHaveLength(125);
    for (const dataLine of lines.slice(2)) {
      expect(dataLine.split(';')).toHaveLength(125);
    }
  });

  it('encodes the output as Windows-1252 (umlaut as single byte, no UTF-8)', () => {
    // "Büro" from the second charge description must survive as CP-1252.
    expect(result.buffer.includes(0xfc)).toBe(true);
    expect(result.buffer.indexOf(Buffer.from([0xc3, 0xbc]))).toBe(-1);
  });

  it('starts from a source sample whose net balance is zero', () => {
    const sourceNet = fixture
      .trim()
      .split('\n')
      .slice(1)
      .map((line: string) => line.split(',')[6] ?? '0')
      .reduce((acc: number, net: string) => acc + Math.round(Number(net) * 100), 0);
    expect(sourceNet).toBe(0);
  });

  it('exposes the effective config', () => {
    expect(result.config.meta.beraterNr).toBe(4711);
    expect(result.config.meta.skr).toBe('SKR03');
  });

  it('returns a balanced, categorized summary', () => {
    expect(result.summary.balanced).toBe(true);
    expect(result.summary.totalDebitCents).toBe(result.summary.totalCreditCents);
    expect(result.summary.byCategory).toEqual({ charge: 2, refund: 1, fee: 1, payout: 1 });
    expect(result.bookings).toHaveLength(7);
  });
});

describe('convert balances the Geldtransit account', () => {
  it('nets to zero across the sample bookings', async () => {
    const { mapTransactions } = await import('../src/mapping/engine');
    const { stripeAdapter } = await import('../src/adapters/stripe');
    const { resolveConfig } = await import('../src/mapping/config');
    const txs = stripeAdapter.parse(fixture);
    const { bookings } = mapTransactions(txs, resolveConfig());
    const net = bookings.reduce((acc, b) => acc + transitDelta(b), 0);
    expect(net).toBe(0);
  });
});
