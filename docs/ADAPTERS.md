# Writing a source adapter

A source adapter is the only thing you need to add a new payment provider. It turns one provider's CSV export into the provider-agnostic transaction model; the mapping engine and EXTF writer handle everything else.

## 1. The contract

An adapter implements `SourceAdapter` (`src/adapters/types.ts`):

```ts
export interface SourceAdapter {
  readonly id: string;        // CLI id, e.g. 'paypal'
  readonly name: string;      // human-readable
  parse(csv: string): NormalizedTransaction[];
}
```

A `NormalizedTransaction` (`src/model/transaction.ts`) is:

```ts
interface NormalizedTransaction {
  id: string;            // source-unique id
  date: Date;            // UTC-midnight calendar day (use parseCalendarDate)
  category: TxCategory;  // 'charge' | 'refund' | 'payout' | 'fee' | 'adjustment' | 'other'
  grossCents: number;    // integer minor units, signed as in source
  feeCents: number;      // integer minor units
  netCents: number;      // gross - fee
  currency: string;      // ISO 4217, upper-case
  description?: string;
  payoutId?: string;     // links a charge/refund to its payout batch
  raw: Record<string, string>;
}
```

**Rules:**
- Money is **integer cents** — use `parseAmountToCents` from `src/util/money.ts`. Never parse into floats.
- Dates use `parseCalendarDate` from `src/util/date.ts` so they are timezone-stable.
- Map the source's transaction types onto the shared `TxCategory` set. Anything you cannot map confidently → `'adjustment'` or `'other'`; the mapping engine will skip it with a warning rather than mis-book it.
- The adapter knows **nothing** about DATEV, accounts, or tax keys. Keep that separation.

## 2. Implement it

`src/adapters/paypal.ts`:

```ts
import { parse } from 'csv-parse/sync';
import type { SourceAdapter } from './types';
import type { NormalizedTransaction } from '../model/transaction';
import { parseAmountToCents } from '../util/money';
import { parseCalendarDate } from '../util/date';

export const paypalAdapter: SourceAdapter = {
  id: 'paypal',
  name: 'PayPal (activity CSV)',
  parse(csv: string): NormalizedTransaction[] {
    const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[];
    return rows.map((row, i) => {
      // …map PayPal columns → the normalized model…
      return {
        id: row['Transaction ID'] ?? `row-${i + 1}`,
        date: parseCalendarDate(row['Date'] ?? ''),
        category: /* classify from row['Type'] */ 'charge',
        grossCents: parseAmountToCents(row['Gross'] ?? '0'),
        feeCents: parseAmountToCents(row['Fee'] ?? '0'),
        netCents: parseAmountToCents(row['Net'] ?? '0'),
        currency: (row['Currency'] ?? 'EUR').toUpperCase(),
        raw: row,
      };
    });
  },
};
```

## 3. Register it

`src/adapters/index.ts`:

```ts
import { paypalAdapter } from './paypal';

const ADAPTERS: Record<string, SourceAdapter> = {
  [stripeAdapter.id]: stripeAdapter,
  [paypalAdapter.id]: paypalAdapter, // <-- add
};
```

That's it — `datev-bridge export.csv --adapter paypal` now works, and the CLI lists it in `--help`.

## 4. Mapping considerations

The default mapping engine (`src/mapping/engine.ts`) already books `charge`/`refund`/`fee`/`payout` against the Geldtransit account. If your source needs different accounting (e.g. PayPal fees are a domestic service, **not** §13b reverse charge like Stripe's Irish fees), either:

- ship a different default config (`configs/paypal-skr03.example.yaml`), or
- extend the engine if the booking shape genuinely differs.

Document the bookkeeping reasoning, ideally with a source.

## 5. Tests & fixtures

- Add a **synthetic** fixture `fixtures/paypal-sample.csv` (no real data) whose net balance ideally sums to zero — that makes the double-entry sanity check easy.
- Add `test/paypal-adapter.test.ts` covering: row count, category classification, cent parsing, signs, date normalization, and header-spelling tolerance.
- Run `npm run check` — typecheck, lint and tests must be green.

## 6. Finish

Update the README's supported-source list and the roadmap. Open a PR describing the source format and your mapping decisions.
