import type { NormalizedTransaction } from '../model/transaction';
import type { BookingRow } from '../model/booking';
import type { MappingConfig } from './config';

/**
 * Turns normalized transactions into DATEV booking rows using the declarative
 * config. Implements the "lean & correct" model:
 *
 *   - Sale (charge):  revenue (gross/brutto) booked Haben on the revenue
 *                     automatic account, contra Geldtransit. Plus the Stripe
 *                     processing fee booked Soll on the fee account with the
 *                     §13b reverse-charge key, contra Geldtransit.
 *   - Refund:         reverses the revenue booking (Soll on revenue account).
 *   - Standalone fee: Soll on fee account, §13b key, contra Geldtransit.
 *   - Payout:         Soll on bank, contra Geldtransit (money leaves Stripe).
 *
 * Stripe = Geldtransit/clearing account: a payout is a transfer, not revenue.
 * No sub-ledger debtors and no pRAP period accrual in the MVP (roadmap).
 * Unsupported categories (disputes/adjustments) are skipped with a warning so
 * the output stays valid; nothing is silently mis-booked.
 */

export interface MappingResult {
  bookings: BookingRow[];
  warnings: string[];
  /** Number of transactions skipped because the category is unsupported. */
  skipped: number;
}

function revenueTarget(config: MappingConfig): { account: number; taxKey: string } {
  if (config.options.defaultVatRate === '7') {
    return { account: config.accounts.revenue7, taxKey: config.taxKeys.revenue7 };
  }
  return { account: config.accounts.revenue19, taxKey: config.taxKeys.revenue19 };
}

function optionalText(value: string | undefined): string | undefined {
  return value && value.trim() !== '' ? value : undefined;
}

export function mapTransactions(
  transactions: NormalizedTransaction[],
  config: MappingConfig,
): MappingResult {
  const bookings: BookingRow[] = [];
  const warnings: string[] = [];
  let skipped = 0;

  const { geldtransit, bank, fees } = config.accounts;

  for (const tx of transactions) {
    const reference = tx.id;
    const text = optionalText(tx.description);

    switch (tx.category) {
      case 'charge': {
        const revenue = revenueTarget(config);
        bookings.push({
          amountCents: Math.abs(tx.grossCents),
          debitCredit: 'H',
          account: revenue.account,
          contraAccount: geldtransit,
          taxKey: revenue.taxKey || undefined,
          currency: tx.currency,
          date: tx.date,
          reference,
          text: text ?? 'Stripe Umsatz',
        });
        if (tx.feeCents !== 0) {
          bookings.push({
            amountCents: Math.abs(tx.feeCents),
            debitCredit: 'S',
            account: fees,
            contraAccount: geldtransit,
            taxKey: config.taxKeys.fees || undefined,
            currency: tx.currency,
            date: tx.date,
            reference,
            text: 'Stripe Gebuehr',
          });
        }
        break;
      }

      case 'refund': {
        const revenue = revenueTarget(config);
        bookings.push({
          amountCents: Math.abs(tx.grossCents),
          debitCredit: 'S',
          account: revenue.account,
          contraAccount: geldtransit,
          taxKey: revenue.taxKey || undefined,
          currency: tx.currency,
          date: tx.date,
          reference,
          text: text ?? 'Stripe Erstattung',
        });
        if (tx.feeCents !== 0) {
          // Stripe refunded the processing fee as well — reverse the fee booking.
          bookings.push({
            amountCents: Math.abs(tx.feeCents),
            debitCredit: 'H',
            account: fees,
            contraAccount: geldtransit,
            taxKey: config.taxKeys.fees || undefined,
            currency: tx.currency,
            date: tx.date,
            reference,
            text: 'Stripe Gebuehr-Erstattung',
          });
        }
        break;
      }

      case 'fee': {
        const amount = Math.abs(tx.netCents !== 0 ? tx.netCents : tx.grossCents);
        bookings.push({
          amountCents: amount,
          debitCredit: 'S',
          account: fees,
          contraAccount: geldtransit,
          taxKey: config.taxKeys.fees || undefined,
          currency: tx.currency,
          date: tx.date,
          reference,
          text: text ?? 'Stripe Gebuehr',
        });
        break;
      }

      case 'payout': {
        const amount = Math.abs(tx.netCents !== 0 ? tx.netCents : tx.grossCents);
        bookings.push({
          amountCents: amount,
          debitCredit: 'S',
          account: bank,
          contraAccount: geldtransit,
          currency: tx.currency,
          date: tx.date,
          reference,
          text: text ?? 'Stripe Auszahlung',
        });
        break;
      }

      default: {
        skipped += 1;
        warnings.push(
          `Skipped transaction ${tx.id} (category "${tx.category}") — not supported in the MVP; book it manually.`,
        );
      }
    }
  }

  return { bookings, warnings, skipped };
}
