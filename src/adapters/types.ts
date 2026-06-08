import type { NormalizedTransaction } from '../model/transaction';

/**
 * A source adapter turns one provider's CSV export into normalized
 * transactions. Adding a new payment source = implementing this interface and
 * registering it. The adapter knows nothing about DATEV — it only normalizes.
 */
export interface SourceAdapter {
  /** Stable id used on the CLI (`--adapter <id>`), e.g. 'stripe'. */
  readonly id: string;
  /** Human-readable name for help output and logs. */
  readonly name: string;
  /** Parse a raw CSV export (UTF-8 string) into normalized transactions. */
  parse(csv: string): NormalizedTransaction[];
}
