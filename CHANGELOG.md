# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] — 2026-06-09

### Added

- First release. Converts a Stripe **"Itemized balance change"** CSV export into a
  DATEV **EXTF Buchungsstapel** (`npx datev-bridge stripe-export.csv -o buchungsstapel.csv`).
- **EXTF writer** verified against the DATEV format description and the
  `ledermann/datev` reference: 31-field Vorlauf header, 125 data columns,
  Windows-1252 encoding, CRLF, comma decimals, `TTMM` Belegdatum, positive Umsatz
  with explicit Soll/Haben.
- **Stripe source adapter** with tolerant header handling and a guard that points
  users to the correct Stripe report when the wrong export is supplied.
- **Mapping engine** (lean & correct model): Geldtransit principle, revenue via VAT
  automatic accounts, Stripe fees as §13b reverse-charge EU (BU 506), refunds,
  payouts. SKR03/SKR04 presets, Zod-validated YAML config.
- **CLI** with a booking summary (per-category counts and a Soll = Haben check),
  friendly error messages, and an embedded disclaimer.
- Library API: `convert()` plus exported adapter/mapping/writer building blocks.
- Docs: README, CONTRIBUTING, adapter plugin guide; synthetic Stripe fixtures;
  MIT license; CI on Node 20 and 22.

### Known limitations

- One default VAT rate per run (per-line VAT detection is on the roadmap).
- Disputes/chargebacks, foreign-currency exchange differences, sub-ledger debtors
  and pRAP period accrual are not yet booked (skipped with a warning).
- Output is validated against the documented spec, not against a live DATEV import.

[Unreleased]: https://github.com/automationsmanufaktur-labs/datev-bridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/automationsmanufaktur-labs/datev-bridge/releases/tag/v0.1.0
