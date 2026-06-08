# Contributing to datev-bridge

Thanks for helping out! The most valuable contributions are **new source adapters** (PayPal, Shopify, bank CSV, …) and corrections to the booking logic from people who do German bookkeeping for a living.

## Ground rules

- **Correctness over features.** One source done correctly beats four done halfway. A DATEV import that is not "green" is useless.
- **No tax claims.** We position datev-bridge as *format-compatible*, never "DATEV-certified" or "GoBD-compliant". Keep the disclaimer intact and prominent.
- **No real customer data.** Fixtures must be synthetic/anonymized.

## Development setup

```bash
npm install
npm run check      # typecheck + lint + test — must be green before a PR
npm run test:watch # TDD loop
npm run build      # bundle to dist/
```

Requirements: Node.js >= 18.

## Code style

- **TypeScript strict, no `any`.** Use `unknown` and narrow. `@typescript-eslint/no-explicit-any` is an error.
- Money is **integer minor units (cents)** everywhere internally — never floats. Format to `"1234,56"` only at write time (`src/util/money.ts`).
- Dates are **UTC-midnight** Date objects, formatted via UTC getters (`src/util/date.ts`), so output is timezone-stable.
- Comments explain **why**, not what.
- Files: kebab-case. Constants: UPPER_SNAKE_CASE.

## Architecture

```
src/
  model/        normalized Transaction + semantic Booking (source/format agnostic)
  adapters/     source CSV  -> Transaction[]        (one file per provider)
  mapping/      Transaction -> Booking[]  + Zod config
  writer/       Booking[]   -> EXTF (encoding, 125 columns, header)
  cli.ts        thin commander wrapper around convert()
  index.ts      library API (convert) + re-exports
```

The three layers (adapter, mapping, writer) are deliberately decoupled: an adapter never knows about DATEV, and the writer never knows about Stripe.

## Adding a source adapter

See **[docs/ADAPTERS.md](./docs/ADAPTERS.md)** for the full step-by-step. In short:

1. Implement the `SourceAdapter` interface in `src/adapters/<source>.ts`.
2. Register it in `src/adapters/index.ts`.
3. Add an example config `configs/<source>-skr03.example.yaml`.
4. Add a synthetic fixture `fixtures/<source>-sample.csv` and tests.
5. `npm run check` green, update the README's source list.

## Commit & PR

- Conventional-commit style is appreciated (`feat(adapter): add paypal`, `fix(writer): …`).
- Every PR keeps `npm run check` green and adds tests for new behavior.
- Describe the bookkeeping reasoning for any change to accounts/tax keys, ideally with a source.

## Reporting booking bugs

If a booking is wrong, please include: the (anonymized) source row, what datev-bridge produced, what the correct DATEV booking should be, and why (with a source if possible). That makes fixes fast and verifiable.
