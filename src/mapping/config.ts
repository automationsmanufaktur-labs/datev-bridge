import { z } from 'zod';
import { parse as parseYaml } from 'yaml';

/**
 * Declarative, versioned mapping configuration. This is the file users edit to
 * fit their chart of accounts and tax keys — nothing about accounts or tax
 * keys is hardcoded in the engine. Validated with Zod at the boundary.
 *
 * Defaults below are verified against German bookkeeping practice for Stripe
 * (Geldtransit principle, revenue automatic accounts, §13b reverse charge on
 * Stripe's Irish fees) BUT remain "to be confirmed by your tax advisor".
 */

const account = z.number().int().positive();

export const MappingConfigSchema = z.object({
  meta: z.object({
    skr: z.enum(['SKR03', 'SKR04']).default('SKR03'),
    /** DATEV Berater-Nr (>= 1001). Placeholder default — set for real imports. */
    beraterNr: z.number().int().min(1001).default(1001),
    /** DATEV Mandanten-Nr. Placeholder default — set for real imports. */
    mandantNr: z.number().int().min(1).default(1),
    /** Wirtschaftsjahresbeginn as MM-DD (year is taken from the data). */
    wirtschaftsjahrBeginn: z
      .string()
      .regex(/^\d{2}-\d{2}$/, 'expected MM-DD')
      .default('01-01'),
    /** Sachkontenlänge (must match the DATEV mandant setup). */
    sachkontenlaenge: z.number().int().min(4).max(8).default(4),
    /** Batch label shown in DATEV (max 30 chars). */
    bezeichnung: z.string().max(30).default('Stripe Buchungsstapel'),
    currency: z.string().length(3).default('EUR'),
    /** 0 = not locked (advisor reviews first), 1 = festgeschrieben. */
    festschreibung: z.union([z.literal(0), z.literal(1)]).default(0),
  }),
  accounts: z.object({
    /** Stripe clearing / Geldtransit account (SKR03 1360 · SKR04 1460). */
    geldtransit: account,
    /** Bank account that receives payouts (SKR03 1200 · SKR04 1800). */
    bank: account,
    /** Revenue 19% automatic account (SKR03 8400 · SKR04 4400). */
    revenue19: account,
    /** Revenue 7% automatic account (SKR03 8300 · SKR04 4300). */
    revenue7: account,
    /** Stripe fee expense account (SKR03 4970 · SKR04 6855). */
    fees: account,
  }),
  taxKeys: z.object({
    /** Empty for the revenue automatic account (DATEV derives 19% itself). */
    revenue19: z.string().default(''),
    /** Empty for the revenue automatic account (DATEV derives 7% itself). */
    revenue7: z.string().default(''),
    /** §13b reverse-charge EU 19% — Stripe fees are billed from Ireland. */
    fees: z.string().default('506'),
  }),
  options: z
    .object({
      /** VAT bucket applied to charges in the MVP (per-line VAT = roadmap). */
      defaultVatRate: z.enum(['19', '7']).default('19'),
    })
    .default({ defaultVatRate: '19' }),
});

export type MappingConfig = z.infer<typeof MappingConfigSchema>;
export type MappingConfigInput = z.input<typeof MappingConfigSchema>;

/** SKR03 preset (default). */
export const PRESET_SKR03: MappingConfigInput = {
  meta: { skr: 'SKR03' },
  accounts: { geldtransit: 1360, bank: 1200, revenue19: 8400, revenue7: 8300, fees: 4970 },
  taxKeys: { revenue19: '', revenue7: '', fees: '506' },
  options: { defaultVatRate: '19' },
};

/** SKR04 preset. */
export const PRESET_SKR04: MappingConfigInput = {
  meta: { skr: 'SKR04' },
  accounts: { geldtransit: 1460, bank: 1800, revenue19: 4400, revenue7: 4300, fees: 6855 },
  taxKeys: { revenue19: '', revenue7: '', fees: '506' },
  options: { defaultVatRate: '19' },
};

/** Meta values that can be overridden directly from the CLI. */
export interface ConfigOverrides {
  skr?: 'SKR03' | 'SKR04';
  beraterNr?: number;
  mandantNr?: number;
  bezeichnung?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Shallow-by-section deep merge sufficient for this two-level config shape. */
function mergeConfig(
  base: MappingConfigInput,
  override: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = result[key];
    if (isPlainObject(value) && isPlainObject(current)) {
      result[key] = { ...current, ...value };
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Resolve the effective config from an optional user YAML/object plus CLI
 * overrides. The SKR preset is chosen first (so users only override what
 * differs), then the user config, then CLI flags, then Zod validation.
 */
export function resolveConfig(
  userConfig?: unknown,
  overrides: ConfigOverrides = {},
): MappingConfig {
  const userObject = isPlainObject(userConfig) ? userConfig : {};
  const userMeta = isPlainObject(userObject['meta']) ? userObject['meta'] : {};

  const skr =
    overrides.skr ??
    (userMeta['skr'] === 'SKR04' ? 'SKR04' : userMeta['skr'] === 'SKR03' ? 'SKR03' : undefined) ??
    'SKR03';

  const preset = skr === 'SKR04' ? PRESET_SKR04 : PRESET_SKR03;

  let merged = mergeConfig(preset, userObject);

  const metaOverrides: Record<string, unknown> = {};
  if (overrides.skr !== undefined) metaOverrides['skr'] = overrides.skr;
  if (overrides.beraterNr !== undefined) metaOverrides['beraterNr'] = overrides.beraterNr;
  if (overrides.mandantNr !== undefined) metaOverrides['mandantNr'] = overrides.mandantNr;
  if (overrides.bezeichnung !== undefined) metaOverrides['bezeichnung'] = overrides.bezeichnung;
  if (Object.keys(metaOverrides).length > 0) {
    const currentMeta = isPlainObject(merged['meta']) ? merged['meta'] : {};
    merged = { ...merged, meta: { ...currentMeta, ...metaOverrides } };
  }

  return MappingConfigSchema.parse(merged);
}

/** Parse a YAML config string into a validated config (with preset + overrides). */
export function loadConfigFromYaml(yaml: string, overrides: ConfigOverrides = {}): MappingConfig {
  const parsed: unknown = parseYaml(yaml);
  return resolveConfig(parsed, overrides);
}
