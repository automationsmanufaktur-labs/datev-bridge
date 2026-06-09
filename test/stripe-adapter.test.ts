import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { stripeAdapter } from '../src/adapters/stripe';

const fixture = readFileSync(
  new URL('../fixtures/stripe-balance-sample.csv', import.meta.url),
  'utf8',
);

describe('stripeAdapter', () => {
  const txs = stripeAdapter.parse(fixture);

  it('parses every row', () => {
    expect(txs).toHaveLength(5);
  });

  it('classifies categories from reporting_category', () => {
    expect(txs.map((t) => t.category)).toEqual(['charge', 'charge', 'refund', 'fee', 'payout']);
  });

  it('parses amounts into integer cents', () => {
    const charge = txs[0]!;
    expect(charge.grossCents).toBe(11900);
    expect(charge.feeCents).toBe(250);
    expect(charge.netCents).toBe(11650);
  });

  it('keeps signs for outflows', () => {
    const payout = txs[4]!;
    expect(payout.grossCents).toBe(-28880);
    expect(payout.netCents).toBe(-28880);
  });

  it('normalizes dates to UTC midnight', () => {
    expect(txs[0]!.date.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  it('upper-cases the currency', () => {
    expect(txs[0]!.currency).toBe('EUR');
  });

  it('keeps the net balance at zero across the sample', () => {
    const sum = txs.reduce((acc, t) => acc + t.netCents, 0);
    expect(sum).toBe(0);
  });

  it('tolerates alternate header spellings', () => {
    const csv = [
      'balance_transaction_id,Created (UTC),Currency,Gross,Fee,Net,reporting_category,description',
      'txn_x,2026-02-01 00:00:00,EUR,10.00,0.30,9.70,charge,Test',
    ].join('\n');
    const parsed = stripeAdapter.parse(csv);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.grossCents).toBe(1000);
    expect(parsed[0]!.category).toBe('charge');
  });
});

describe('stripeAdapter input guards', () => {
  it('rejects an empty file with a clear message', () => {
    expect(() => stripeAdapter.parse('')).toThrow(/empty/i);
  });

  it('rejects the wrong Stripe report and points to the right one', () => {
    const wrong = ['id,amount,status', 'pi_1,1000,succeeded'].join('\n');
    expect(() => stripeAdapter.parse(wrong)).toThrow(/Itemized balance change/);
  });

  it('names the missing columns', () => {
    const noGross = ['created,reporting_category', '2026-01-01,charge'].join('\n');
    expect(() => stripeAdapter.parse(noGross)).toThrow(/gross/);
  });
});
