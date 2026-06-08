import { describe, expect, it } from 'vitest';
import { formatCentsDe, parseAmountToCents } from '../src/util/money';

describe('parseAmountToCents', () => {
  it('parses plain decimals', () => {
    expect(parseAmountToCents('119.00')).toBe(11900);
    expect(parseAmountToCents('2.50')).toBe(250);
    expect(parseAmountToCents('0.05')).toBe(5);
  });

  it('parses integers and fractional-only values', () => {
    expect(parseAmountToCents('12')).toBe(1200);
    expect(parseAmountToCents('.5')).toBe(50);
  });

  it('handles negatives and blanks', () => {
    expect(parseAmountToCents('-288.80')).toBe(-28880);
    expect(parseAmountToCents('')).toBe(0);
    expect(parseAmountToCents('  ')).toBe(0);
  });

  it('rounds a third decimal half-up', () => {
    expect(parseAmountToCents('1.005')).toBe(101);
    expect(parseAmountToCents('1.004')).toBe(100);
  });

  it('rejects thousands separators and garbage', () => {
    expect(() => parseAmountToCents('1,234.56')).toThrow();
    expect(() => parseAmountToCents('1.234.56')).toThrow();
    expect(() => parseAmountToCents('abc')).toThrow();
  });
});

describe('formatCentsDe', () => {
  it('formats with comma and two decimals', () => {
    expect(formatCentsDe(11900)).toBe('119,00');
    expect(formatCentsDe(250)).toBe('2,50');
    expect(formatCentsDe(5)).toBe('0,05');
    expect(formatCentsDe(0)).toBe('0,00');
  });

  it('keeps the sign', () => {
    expect(formatCentsDe(-28880)).toBe('-288,80');
  });

  it('round-trips with the parser', () => {
    for (const value of ['0.00', '7.07', '1234.56', '999999.99']) {
      expect(formatCentsDe(parseAmountToCents(value))).toBe(value.replace('.', ','));
    }
  });
});
