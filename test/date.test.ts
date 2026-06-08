import { describe, expect, it } from 'vitest';
import {
  formatJJJJMMTT,
  formatTTMM,
  formatTimestamp,
  parseCalendarDate,
} from '../src/util/date';

describe('parseCalendarDate', () => {
  it('parses Stripe space format to UTC midnight', () => {
    const date = parseCalendarDate('2026-01-05 10:00:00');
    expect(date.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  it('parses ISO format', () => {
    const date = parseCalendarDate('2026-01-05T23:59:59Z');
    expect(date.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  it('throws on unparseable input', () => {
    expect(() => parseCalendarDate('not-a-date')).toThrow();
  });
});

describe('date formatters', () => {
  const date = parseCalendarDate('2026-03-07');

  it('formats TTMM with leading zeros', () => {
    expect(formatTTMM(date)).toBe('0703');
  });

  it('formats JJJJMMTT', () => {
    expect(formatJJJJMMTT(date)).toBe('20260307');
  });

  it('formats the header timestamp with millis', () => {
    expect(formatTimestamp(new Date('2026-03-07T10:25:00Z'))).toBe('20260307102500000');
  });
});
