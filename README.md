<div align="center">

<img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/banner.svg" alt="datev-bridge — Stripe CSV to DATEV EXTF Buchungsstapel" width="100%" />

<p>
  <a href="https://www.npmjs.com/package/datev-bridge"><img src="https://img.shields.io/npm/v/datev-bridge?color=3FB950&amp;label=npm" alt="npm version" /></a>
  <a href="https://github.com/automationsmanufaktur-labs/datev-bridge/actions/workflows/ci.yml"><img src="https://github.com/automationsmanufaktur-labs/datev-bridge/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >= 18" />
</p>

<strong>Convert CSV exports from payment tools into a DATEV EXTF Buchungsstapel</strong><br />
adapter-based, with a declarative, versioned mapping. Stripe today; PayPal, Shopify, bank CSV next.

**English** · [Deutsch](README.de.md)

</div>

```bash
npx datev-bridge stripe-export.csv -o buchungsstapel.csv
```

<p align="center">
  <img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/terminal.svg" alt="Terminal demo: 7 bookings from 5 transactions, Soll = Haben check" width="760" />
</p>

---

> [!IMPORTANT]
> **datev-bridge is _format-compatible_ with the DATEV EXTF import — it is not a DATEV product, not DATEV-certified, and makes no GoBD guarantee.** The account and tax-key defaults reflect common German practice for Stripe but **must be confirmed by your tax advisor (Steuerberater)** for your specific situation (Kleinunternehmer, reverse-charge handling, chart-of-accounts setup). You stay responsible for what you import.

## Why

Stripe (and friends) export CSVs; DATEV imports the EXTF "Buchungsstapel". Bridging the two correctly is fiddly: a Stripe **payout is not revenue** (Stripe behaves like a bank account / Geldtransit), the **processing fees are an EU reverse-charge service (§13b UStG)** because Stripe bills from Ireland, and DATEV only imports if the file is byte-correct (ISO-8859-1/Windows-1252, semicolons, CRLF, comma decimals, the right column order).

The existing open-source tools either pull from the **API** (needs keys) or are pure **format writers** with no source mapping, and the only one with real mapping is single-source Python. **datev-bridge fills the open niche: an OSS, CSV-based (no API key), Node/`npx` CLI with a source-adapter architecture and code-as-config mapping you can version in git.**

## What it does

<p align="center">
  <img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/pipeline.svg" alt="Pipeline: Stripe CSV → adapter → Transaction[] → mapping + YAML → Booking[] → EXTF writer → buchungsstapel.csv" width="100%" />
</p>

- **Source adapters** normalize a provider's CSV into a provider-agnostic transaction model. New source = one new adapter.
- **Declarative mapping** (YAML, validated with Zod) holds your accounts and tax keys — nothing is hardcoded.
- **EXTF writer** produces a spec-correct Buchungsstapel: 31-field Vorlauf header, 125 data columns, Windows-1252 encoding, CRLF, comma decimals, `TTMM` Belegdatum, positive Umsatz with explicit Soll/Haben.

## Install

```bash
# one-off
npx datev-bridge --help

# or install globally
npm i -g datev-bridge
```

Requirements: Node.js >= 18.

## Usage

```bash
datev-bridge <input.csv> [options]

Options:
  -o, --output <file>     output EXTF file            (default: buchungsstapel.csv)
  -a, --adapter <id>      source adapter              (default: stripe)
  -c, --config <file>     YAML mapping config (merged onto the SKR preset)
      --skr <skr>         SKR03 | SKR04
      --berater <nr>      DATEV Berater-Nr (>= 1001)
      --mandant <nr>      DATEV Mandanten-Nr
      --bezeichnung <txt> batch label shown in DATEV
      --stdout            write bytes to stdout instead of a file
```

### Get the right Stripe export

In the Stripe Dashboard → **Reports → Balance → "Balance change from activity"**, export the **Itemized** report for your period. That report lists every money movement (charges, fees, refunds, payouts), which is what you need for full bookkeeping. (See [Stripe docs](https://docs.stripe.com/reports/report-types/balance).)

### Example

```bash
datev-bridge stripe-itemized-2026-01.csv \
  -o buchungsstapel-2026-01.csv \
  -c my-mapping.yaml \
  --berater 12345 --mandant 678
```

## How the booking works (lean & correct model)

Stripe is treated as a **Geldtransit / clearing account** — a payout is a transfer to your bank, not revenue. Defaults for **SKR03** (SKR04 in parentheses):

| Transaction        | Soll (debit)         | Haben (credit)        | Tax key | Note |
|--------------------|----------------------|-----------------------|---------|------|
| Sale (charge)      | Geldtransit 1360 (1460) | Erlöse 19% 8400 (4400) | — automatic | gross/brutto; DATEV derives the VAT |
| Stripe fee         | Gebühren 4970 (6855) | Geldtransit 1360 (1460) | **506** | §13b reverse charge EU 19% |
| Refund             | Erlöse 19% 8400 (4400) | Geldtransit 1360 (1460) | — automatic | reverses the sale |
| Payout to bank     | Bank 1200 (1800)     | Geldtransit 1360 (1460) | — | money leaves Stripe |

Two defaults are the usual sources of error, and both are handled here:

1. **Geldtransit principle** — booking the payout, not the individual sales, as revenue is wrong. Sales hit revenue; the payout only moves the net to the bank.
2. **§13b on fees** — Stripe Payments Europe bills from Ireland, so the fee is a reverse-charge service. The default key is **506** (§13b EU 19%), *not* the generic BU 94, which would force a manual EU selection on every booking.

> All of this is configurable in the YAML mapping, and all of it should be confirmed by your tax advisor.

## Configuration

Start from a preset and override only what differs. See [`configs/stripe-skr03.example.yaml`](./configs/stripe-skr03.example.yaml) and [`configs/stripe-skr04.example.yaml`](./configs/stripe-skr04.example.yaml).

```yaml
meta:
  skr: SKR03
  beraterNr: 12345        # required for a real import
  mandantNr: 678
  sachkontenlaenge: 4     # must match the DATEV mandant setup
  festschreibung: 0       # 0 = advisor reviews before locking
accounts:
  geldtransit: 1360
  bank: 1200
  revenue19: 8400
  revenue7: 8300
  fees: 4970
taxKeys:
  revenue19: ""           # automatic account → empty
  fees: "506"             # §13b reverse charge EU 19%
options:
  defaultVatRate: "19"
```

Without `-c`, the built-in SKR03 defaults are used (with placeholder Berater/Mandant numbers and a warning).

## Supported transactions & limits

**Supported now:** charge (revenue + fee), refund, standalone Stripe fee, payout.

**Not yet (skipped with a warning, never silently mis-booked):** disputes/chargebacks, balance adjustments, foreign-currency exchange differences, per-line VAT detection (the MVP applies one default VAT rate), sub-ledger debtors, and pRAP period accrual. These are on the [roadmap](#roadmap).

Each export must cover a **single fiscal year** — EXTF stores the Belegdatum as `TTMM` without a year, so datev-bridge refuses a mixed-year file rather than guess.

> [!NOTE]
> **Kleinunternehmer (§19 UStG):** the defaults assume a VAT-liable business with full input-tax deduction, so the §13b reverse charge on Stripe fees nets to zero. If you use the §19 small-business scheme, §13b still applies but the self-assessed VAT becomes a real cost (no input-tax deduction), and revenue is booked without VAT — adjust the mapping accordingly and confirm with your tax advisor.

## Use as a library

```ts
import { convert } from 'datev-bridge';
import { readFileSync } from 'node:fs';

const { buffer, bookingCount, warnings } = convert({
  csv: readFileSync('stripe-export.csv', 'utf8'),
  overrides: { skr: 'SKR04', beraterNr: 12345, mandantNr: 678 },
});
writeFileSync('buchungsstapel.csv', buffer); // CP-1252 bytes
```

## Roadmap

- [ ] PayPal, Shopify Payments and generic bank-CSV adapters
- [ ] Foreign-currency exchange-difference handling
- [ ] Per-line VAT detection (tax columns / metadata)
- [ ] Dispute / chargeback bookings
- [ ] Optional pRAP period accrual for subscriptions
- [ ] Sub-ledger debtor bookings

## Contributing

New source adapters are very welcome — that is the whole point of the architecture. See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [adapter guide](./docs/ADAPTERS.md).

## Development

```bash
npm install
npm run check      # typecheck + lint + test
npm run build      # bundle to dist/ via tsup
```

## Acknowledgements

Format and mapping cross-checked against the open, MIT-licensed
[`ledermann/datev`](https://github.com/ledermann/datev) (EXTF reference) and
[`jonaswitt/stripe-datev-exporter`](https://github.com/jonaswitt/stripe-datev-exporter)
(Stripe booking logic). The DATEV field semantics are re-implemented from the
public [format description](https://developer.datev.de/de/file-format), not copied.

## License

[MIT](./LICENSE) © Julian Abt. "DATEV" is a trademark of DATEV eG; this project is independent and not affiliated with or endorsed by DATEV.
