/**
 * A single DATEV booking line in semantic form — i.e. before it is serialized
 * into the 125-column EXTF row. The mapping engine produces these; the EXTF
 * writer formats them.
 *
 * DATEV models a booking as: an amount, a Soll/Haben direction relative to the
 * primary account (`account`), a contra account (`contraAccount`) and an
 * optional tax key (BU-Schlüssel). For VAT automatic accounts the tax key is
 * left empty because DATEV derives the tax itself.
 */

export type DebitCredit = 'S' | 'H';

export interface BookingRow {
  /** Amount in integer minor units. ALWAYS positive — direction is in `debitCredit`. */
  amountCents: number;
  /** 'S' = Soll on `account`, 'H' = Haben on `account`. */
  debitCredit: DebitCredit;
  /**
   * Primary account ("Konto"). For VAT automatic accounts (e.g. SKR03 8400)
   * put the revenue/expense account here so DATEV applies the automatic key.
   */
  account: number;
  /** Contra account ("Gegenkonto"). */
  contraAccount: number;
  /** DATEV BU-/Steuerschlüssel. Empty/undefined for automatic accounts. */
  taxKey?: string;
  /** Currency ISO code, written into "WKZ Umsatz". */
  currency: string;
  /** Booking date. The year must match the fiscal year (EXTF stores only TTMM). */
  date: Date;
  /** Belegfeld 1 — receipt reference (e.g. source txn id). */
  reference?: string;
  /** Buchungstext (free text, max 60 chars after sanitizing). */
  text?: string;
}
