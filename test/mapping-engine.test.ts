import { describe, expect, it } from 'vitest';
import { mapTransactions } from '../src/mapping/engine';
import { resolveConfig } from '../src/mapping/config';
import type { NormalizedTransaction, TxCategory } from '../src/model/transaction';

const config = resolveConfig();

function tx(
  category: TxCategory,
  grossCents: number,
  feeCents = 0,
  netCents = grossCents - feeCents,
): NormalizedTransaction {
  return {
    id: 'txn_test',
    date: new Date(Date.UTC(2026, 0, 5)),
    category,
    grossCents,
    feeCents,
    netCents,
    currency: 'EUR',
    raw: {},
  };
}

describe('mapTransactions (SKR03 defaults)', () => {
  it('books a charge as revenue (Haben 8400) plus a §13b fee (Soll 4970)', () => {
    const { bookings } = mapTransactions([tx('charge', 11900, 250)], config);
    expect(bookings).toHaveLength(2);

    const revenue = bookings[0]!;
    expect(revenue.account).toBe(8400);
    expect(revenue.contraAccount).toBe(1360);
    expect(revenue.debitCredit).toBe('H');
    expect(revenue.amountCents).toBe(11900);
    expect(revenue.taxKey).toBeUndefined(); // automatic account → empty key

    const fee = bookings[1]!;
    expect(fee.account).toBe(4970);
    expect(fee.contraAccount).toBe(1360);
    expect(fee.debitCredit).toBe('S');
    expect(fee.amountCents).toBe(250);
    expect(fee.taxKey).toBe('506');
  });

  it('omits the fee booking when there is no fee', () => {
    const { bookings } = mapTransactions([tx('charge', 5000, 0)], config);
    expect(bookings).toHaveLength(1);
  });

  it('reverses revenue on a refund (Soll 8400)', () => {
    const { bookings } = mapTransactions([tx('refund', -5950, 0)], config);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.account).toBe(8400);
    expect(bookings[0]!.debitCredit).toBe('S');
    expect(bookings[0]!.amountCents).toBe(5950);
  });

  it('books a standalone Stripe fee with the §13b key', () => {
    const { bookings } = mapTransactions([tx('fee', -200, 0)], config);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.account).toBe(4970);
    expect(bookings[0]!.debitCredit).toBe('S');
    expect(bookings[0]!.amountCents).toBe(200);
    expect(bookings[0]!.taxKey).toBe('506');
  });

  it('books a payout from Geldtransit to bank (Soll 1200)', () => {
    const { bookings } = mapTransactions([tx('payout', -28880, 0)], config);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.account).toBe(1200);
    expect(bookings[0]!.contraAccount).toBe(1360);
    expect(bookings[0]!.debitCredit).toBe('S');
    expect(bookings[0]!.amountCents).toBe(28880);
    expect(bookings[0]!.taxKey).toBeUndefined();
  });

  it('skips unsupported categories with a warning', () => {
    const { bookings, skipped, warnings } = mapTransactions([tx('adjustment', 1000)], config);
    expect(bookings).toHaveLength(0);
    expect(skipped).toBe(1);
    expect(warnings).toHaveLength(1);
  });

  it('uses the 7% revenue account when defaultVatRate is 7', () => {
    const config7 = resolveConfig({ options: { defaultVatRate: '7' } });
    const { bookings } = mapTransactions([tx('charge', 1070, 0)], config7);
    expect(bookings[0]!.account).toBe(8300);
  });
});

describe('mapTransactions (SKR04)', () => {
  it('uses SKR04 accounts', () => {
    const config04 = resolveConfig({ meta: { skr: 'SKR04' } });
    const { bookings } = mapTransactions([tx('charge', 11900, 250)], config04);
    expect(bookings[0]!.account).toBe(4400);
    expect(bookings[0]!.contraAccount).toBe(1460);
    expect(bookings[1]!.account).toBe(6855);
  });
});
