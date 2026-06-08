import { describe, expect, it } from 'vitest';
import { writeExtf } from '../src/writer/extf';
import { COLUMN_NAMES } from '../src/writer/columns';
import { resolveConfig } from '../src/mapping/config';
import type { BookingRow } from '../src/model/booking';

const config = resolveConfig(undefined, { beraterNr: 4711, mandantNr: 222 });
const generatedAt = new Date('2026-02-01T10:25:00Z');

const charge: BookingRow = {
  amountCents: 11900,
  debitCredit: 'H',
  account: 8400,
  contraAccount: 1360,
  currency: 'EUR',
  date: new Date(Date.UTC(2026, 0, 5)),
  reference: 'txn_0001',
  text: 'Rechnung INV-1001',
};

const fee: BookingRow = {
  amountCents: 250,
  debitCredit: 'S',
  account: 4970,
  contraAccount: 1360,
  taxKey: '506',
  currency: 'EUR',
  date: new Date(Date.UTC(2026, 0, 5)),
  reference: 'txn_0001',
  text: 'Stripe Gebuehr',
};

describe('writeExtf header', () => {
  const { text } = writeExtf([charge, fee], config, { generatedAt });
  const lines = text.split('\r\n');

  it('starts with the EXTF Vorlauf marker', () => {
    expect(lines[0]!.startsWith('"EXTF";700;21;"Buchungsstapel";13;')).toBe(true);
  });

  it('has exactly 31 header fields', () => {
    expect(lines[0]!.split(';')).toHaveLength(31);
  });

  it('writes the generated-at timestamp, berater and mandant', () => {
    const fields = lines[0]!.split(';');
    expect(fields[5]).toBe('20260201102500000');
    expect(fields[10]).toBe('4711');
    expect(fields[11]).toBe('222');
  });

  it('writes the column-heading row with 125 quoted names', () => {
    const headings = lines[1]!.split(';');
    expect(headings).toHaveLength(125);
    expect(headings[0]).toBe(`"${COLUMN_NAMES[0]}"`);
  });
});

describe('writeExtf data rows', () => {
  const { text } = writeExtf([charge, fee], config, { generatedAt });
  const lines = text.split('\r\n');

  it('writes one 125-field row per booking', () => {
    const row = lines[2]!.split(';');
    expect(row).toHaveLength(125);
  });

  it('maps the charge into the correct columns', () => {
    const row = lines[2]!.split(';');
    expect(row[0]).toBe('119,00'); // Umsatz, positive, comma decimal, unquoted
    expect(row[1]).toBe('"H"'); // Soll/Haben, quoted
    expect(row[2]).toBe('"EUR"'); // WKZ Umsatz
    expect(row[6]).toBe('8400'); // Konto
    expect(row[7]).toBe('1360'); // Gegenkonto
    expect(row[8]).toBe(''); // BU-Schlüssel empty (automatic account)
    expect(row[9]).toBe('0501'); // Belegdatum TTMM
    expect(row[10]).toBe('"txn0001"'); // Belegfeld 1, underscore stripped
    expect(row[13]).toBe('"Rechnung INV-1001"'); // Buchungstext
  });

  it('writes the §13b tax key for the fee booking', () => {
    const row = lines[3]!.split(';');
    expect(row[0]).toBe('2,50');
    expect(row[1]).toBe('"S"');
    expect(row[6]).toBe('4970');
    expect(row[8]).toBe('"506"');
  });

  it('terminates every line with CRLF', () => {
    const { text: raw } = writeExtf([charge], config, { generatedAt });
    expect(raw.endsWith('\r\n')).toBe(true);
    expect((raw.match(/\r\n/g) ?? []).length).toBe(3); // header + headings + 1 row
  });
});

describe('writeExtf guards', () => {
  it('throws on empty input', () => {
    expect(() => writeExtf([], config, { generatedAt })).toThrow(/No bookings/);
  });

  it('throws when bookings span multiple fiscal years', () => {
    const next: BookingRow = { ...charge, date: new Date(Date.UTC(2027, 0, 5)) };
    expect(() => writeExtf([charge, next], config, { generatedAt })).toThrow(/multiple years/);
  });
});
