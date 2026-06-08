/**
 * The DATEV "Buchungsstapel" (Datenkategorie 21, format version 13) has exactly
 * 125 data columns. We build the official German column-heading list
 * programmatically to avoid transcription errors in the repeated groups
 * (Beleginfo 1–8, Zusatzinformation 1–20), then expose the zero-based indices
 * of the columns we actually fill.
 *
 * Derived from the DATEV format description (developer.datev.de) and
 * cross-checked against the open ledermann/datev reference; the field names are
 * factual interface labels, re-implemented rather than copied.
 */

function buildColumnNames(): string[] {
  const names: string[] = [
    'Umsatz (ohne Soll/Haben-Kz)',
    'Soll/Haben-Kennzeichen',
    'WKZ Umsatz',
    'Kurs',
    'Basis-Umsatz',
    'WKZ Basis-Umsatz',
    'Konto',
    'Gegenkonto (ohne BU-Schlüssel)',
    'BU-Schlüssel',
    'Belegdatum',
    'Belegfeld 1',
    'Belegfeld 2',
    'Skonto',
    'Buchungstext',
    'Postensperre',
    'Diverse Adressnummer',
    'Geschäftspartnerbank',
    'Sachverhalt',
    'Zinssperre',
    'Beleglink',
  ];

  for (let i = 1; i <= 8; i++) {
    names.push(`Beleginfo - Art ${i}`, `Beleginfo - Inhalt ${i}`);
  }

  names.push(
    'KOST1 - Kostenstelle',
    'KOST2 - Kostenstelle',
    'Kost-Menge',
    'EU-Land u. UStID',
    'EU-Steuersatz',
    'Abw. Versteuerungsart',
    'Sachverhalt L+L',
    'Funktionsergänzung L+L',
    'BU 49 Hauptfunktionstyp',
    'BU 49 Hauptfunktionsnummer',
    'BU 49 Funktionsergänzung',
  );

  for (let i = 1; i <= 20; i++) {
    names.push(`Zusatzinformation - Art ${i}`, `Zusatzinformation - Inhalt ${i}`);
  }

  names.push(
    'Stück',
    'Gewicht',
    'Zahlweise',
    'Forderungsart',
    'Veranlagungsjahr',
    'Zugeordnete Fälligkeit',
    'Skontotyp',
    'Auftragsnummer',
    'Buchungstyp',
    'USt-Schlüssel (Anzahlungen)',
    'EU-Mitgliedstaat (Anzahlungen)',
    'Sachverhalt L+L (Anzahlungen)',
    'EU-Steuersatz (Anzahlungen)',
    'Erlöskonto (Anzahlungen)',
    'Herkunft-Kz',
    'Leerfeld',
    'KOST-Datum',
    'SEPA-Mandatsreferenz',
    'Skontosperre',
    'Gesellschaftername',
    'Beteiligtennummer',
    'Identifikationsnummer',
    'Zeichnernummer',
    'Postensperre bis',
    'Bezeichnung SoBil-Sachverhalt',
    'Kennzeichen SoBil-Buchung',
    'Festschreibung',
    'Leistungsdatum',
    'Datum Zuord. Steuerperiode',
    'Fälligkeit',
    'Generalumkehr (GU)',
    'Steuersatz',
    'Land',
    'Abrechnungsreferenz',
    'BVV-Position',
    'EU-Mitgliedstaat u. UStID (Ursprung)',
    'EU-Steuersatz (Ursprung)',
    'Abw. Skontokonto',
  );

  return names;
}

export const COLUMN_NAMES: readonly string[] = buildColumnNames();

export const COLUMN_COUNT = 125;

if (COLUMN_NAMES.length !== COLUMN_COUNT) {
  throw new Error(
    `Internal error: expected ${COLUMN_COUNT} EXTF columns, built ${COLUMN_NAMES.length}`,
  );
}

/** Zero-based indices of the columns the writer fills. */
export const COL = {
  UMSATZ: 0,
  SOLL_HABEN: 1,
  WKZ_UMSATZ: 2,
  KONTO: 6,
  GEGENKONTO: 7,
  BU_SCHLUESSEL: 8,
  BELEGDATUM: 9,
  BELEGFELD1: 10,
  BUCHUNGSTEXT: 13,
} as const;
