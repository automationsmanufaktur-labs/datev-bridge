import type { BookingRow } from '../model/booking';
import type { MappingConfig } from '../mapping/config';
import { COL, COLUMN_COUNT, COLUMN_NAMES } from './columns';
import { encodeCp1252 } from './encoding';
import { formatCentsDe } from '../util/money';
import { formatJJJJMMTT, formatTTMM, formatTimestamp } from '../util/date';

/**
 * Serializes booking rows into a valid EXTF "Buchungsstapel":
 *   line 1: 31-field Vorlauf header  ("EXTF";700;21;"Buchungsstapel";13;…)
 *   line 2: 125 column headings
 *   line 3+: one 125-field row per booking
 *
 * Rules enforced (verified against the DATEV format description and the
 * ledermann/datev reference CSV): `;` separator, CRLF line endings, CP-1252
 * encoding, text fields quoted with "" (empty text = nothing, internal " -> ""),
 * numbers/dates unquoted, comma decimals, Belegdatum as TTMM, header dates as
 * JJJJMMTT, Umsatz always positive with an explicit S/H flag.
 */

export interface ExtfWriteOptions {
  /** Timestamp written into the "erzeugt am" header field. */
  generatedAt: Date;
}

export interface ExtfWriteResult {
  /** Encoded file bytes (CP-1252, CRLF) — write these to disk. */
  buffer: Buffer;
  /** Same content as a JS string, for inspection and tests. */
  text: string;
  bookingCount: number;
}

const CRLF = '\r\n';

/** Quote a text field; empty becomes nothing (not ""), internal " is doubled. */
function quoteText(value: string): string {
  if (value === '') return '';
  return `"${value.replace(/"/g, '""')}"`;
}

const BELEGFELD1_MAX = 36;
const BUCHUNGSTEXT_MAX = 60;
const BELEGFELD1_ALLOWED = /[^A-Za-z0-9$%&*+\-/]/g;

function sanitizeBelegfeld1(value: string): string {
  return value.replace(BELEGFELD1_ALLOWED, '').slice(0, BELEGFELD1_MAX);
}

function clampText(value: string, max: number): string {
  return value.slice(0, max);
}

/** Assert every booking falls in the same calendar year (TTMM omits the year). */
function assertSingleFiscalYear(bookings: BookingRow[]): number {
  const years = new Set(bookings.map((b) => b.date.getUTCFullYear()));
  if (years.size > 1) {
    const sorted = [...years].sort((a, b) => a - b);
    throw new Error(
      `Bookings span multiple years (${sorted.join(', ')}). EXTF stores Belegdatum as TTMM ` +
        `without a year, so each export must cover a single fiscal year. Split the input by year.`,
    );
  }
  const [year] = [...years];
  return year ?? new Date().getUTCFullYear();
}

function buildHeaderLine(
  bookings: BookingRow[],
  config: MappingConfig,
  year: number,
  generatedAt: Date,
): string {
  const dates = bookings.map((b) => b.date.getTime());
  const datumVon = formatJJJJMMTT(new Date(Math.min(...dates)));
  const datumBis = formatJJJJMMTT(new Date(Math.max(...dates)));
  const [wjMonth, wjDay] = config.meta.wirtschaftsjahrBeginn.split('-');
  const wjBeginn = `${year}${wjMonth}${wjDay}`;

  const fields: string[] = [
    quoteText('EXTF'), // 1 format marker (external program)
    '700', // 2 version number
    '21', // 3 Datenkategorie = Buchungsstapel
    quoteText('Buchungsstapel'), // 4 format name
    '13', // 5 format version
    formatTimestamp(generatedAt), // 6 erzeugt am
    '', // 7 imported (must stay empty)
    '', // 8 Herkunft (set by DATEV on import)
    quoteText('datev-bridge'), // 9 exported by
    '', // 10 imported by (must stay empty)
    String(config.meta.beraterNr), // 11 Berater
    String(config.meta.mandantNr), // 12 Mandant
    wjBeginn, // 13 Wirtschaftsjahresbeginn
    String(config.meta.sachkontenlaenge), // 14 Sachkontenlänge
    datumVon, // 15 Datum von
    datumBis, // 16 Datum bis
    quoteText(clampText(config.meta.bezeichnung, 30)), // 17 Bezeichnung
    '', // 18 Diktatkürzel
    '1', // 19 Buchungstyp = Finanzbuchführung
    '', // 20 Rechnungslegungszweck
    String(config.meta.festschreibung), // 21 Festschreibung
    quoteText(config.meta.currency), // 22 WKZ
    '', // 23
    '', // 24
    '', // 25
    '', // 26
    '', // 27
    '', // 28
    '', // 29
    '', // 30
    '', // 31
  ];

  if (fields.length !== 31) {
    throw new Error(`Internal error: header must have 31 fields, built ${fields.length}`);
  }
  return fields.join(';');
}

function buildDataLine(booking: BookingRow): string {
  const cells: string[] = new Array<string>(COLUMN_COUNT).fill('');

  cells[COL.UMSATZ] = formatCentsDe(Math.abs(booking.amountCents));
  cells[COL.SOLL_HABEN] = quoteText(booking.debitCredit);
  cells[COL.WKZ_UMSATZ] = quoteText(booking.currency);
  cells[COL.KONTO] = String(booking.account);
  cells[COL.GEGENKONTO] = String(booking.contraAccount);
  if (booking.taxKey && booking.taxKey !== '') {
    cells[COL.BU_SCHLUESSEL] = quoteText(booking.taxKey);
  }
  cells[COL.BELEGDATUM] = formatTTMM(booking.date);
  if (booking.reference) {
    cells[COL.BELEGFELD1] = quoteText(sanitizeBelegfeld1(booking.reference));
  }
  if (booking.text) {
    cells[COL.BUCHUNGSTEXT] = quoteText(clampText(booking.text, BUCHUNGSTEXT_MAX));
  }

  return cells.join(';');
}

export function writeExtf(
  bookings: BookingRow[],
  config: MappingConfig,
  options: ExtfWriteOptions,
): ExtfWriteResult {
  if (bookings.length === 0) {
    throw new Error('No bookings to write — the input produced zero DATEV rows.');
  }

  const year = assertSingleFiscalYear(bookings);

  const lines: string[] = [
    buildHeaderLine(bookings, config, year, options.generatedAt),
    COLUMN_NAMES.map(quoteText).join(';'),
    ...bookings.map(buildDataLine),
  ];

  const text = lines.map((line) => line + CRLF).join('');
  return {
    buffer: encodeCp1252(text),
    text,
    bookingCount: bookings.length,
  };
}
