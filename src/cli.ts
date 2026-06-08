#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { Command, Option } from 'commander';
import { parse as parseYaml } from 'yaml';
import { convert, type ConfigOverrides } from './index';
import { listAdapters } from './adapters';

const DISCLAIMER =
  'Hinweis: datev-bridge erzeugt ein zum DATEV-EXTF-Import FORMAT-kompatibles ' +
  'Buchungsstapel-CSV. Es ist kein DATEV-Produkt, nicht DATEV-zertifiziert und ' +
  'gibt keine GoBD-Garantie. Konten und Steuerschlüssel vom Steuerberater prüfen lassen.';

interface CliOptions {
  output: string;
  adapter: string;
  config?: string;
  skr?: 'SKR03' | 'SKR04';
  berater?: string;
  mandant?: string;
  bezeichnung?: string;
  stdout?: boolean;
}

function buildOverrides(opts: CliOptions): ConfigOverrides {
  const overrides: ConfigOverrides = {};
  if (opts.skr) overrides.skr = opts.skr;
  if (opts.berater !== undefined) overrides.beraterNr = Number(opts.berater);
  if (opts.mandant !== undefined) overrides.mandantNr = Number(opts.mandant);
  if (opts.bezeichnung !== undefined) overrides.bezeichnung = opts.bezeichnung;
  return overrides;
}

const program = new Command();

program
  .name('datev-bridge')
  .description(
    'Convert payment-tool CSV exports (Stripe, …) into DATEV EXTF Buchungsstapel.\n' +
      'Format-compatible, not DATEV-certified — have results checked by a tax advisor.',
  )
  .version('0.1.0')
  .argument('<input>', 'source CSV export (e.g. Stripe "Itemized balance change")')
  .requiredOption('-o, --output <file>', 'output EXTF file', 'buchungsstapel.csv')
  .addOption(
    new Option('-a, --adapter <id>', 'source adapter')
      .choices(listAdapters().map((a) => a.id))
      .default('stripe'),
  )
  .option('-c, --config <file>', 'YAML mapping config (merged onto the SKR preset)')
  .addOption(new Option('--skr <skr>', 'chart of accounts').choices(['SKR03', 'SKR04']))
  .option('--berater <nr>', 'DATEV Berater-Nr (>= 1001)')
  .option('--mandant <nr>', 'DATEV Mandanten-Nr')
  .option('--bezeichnung <text>', 'batch label shown in DATEV')
  .option('--stdout', 'write EXTF bytes to stdout instead of a file')
  .addHelpText('after', `\n${DISCLAIMER}`)
  .action((input: string, opts: CliOptions) => {
    try {
      const csv = readFileSync(input, 'utf8');
      const userConfig: unknown = opts.config
        ? parseYaml(readFileSync(opts.config, 'utf8'))
        : undefined;

      const result = convert({
        csv,
        adapterId: opts.adapter,
        config: userConfig,
        overrides: buildOverrides(opts),
      });

      if (opts.stdout) {
        process.stdout.write(result.buffer);
      } else {
        writeFileSync(opts.output, result.buffer);
      }

      const out = opts.stdout ? '(stdout)' : opts.output;
      process.stderr.write(
        `✓ ${result.bookingCount} Buchungen aus ${result.transactionCount} Transaktionen → ${out}\n` +
          `  SKR: ${result.config.meta.skr} · Berater ${result.config.meta.beraterNr} · ` +
          `Mandant ${result.config.meta.mandantNr} · Encoding Windows-1252\n`,
      );
      if (result.skipped > 0) {
        process.stderr.write(`  ⚠ ${result.skipped} Transaktion(en) übersprungen:\n`);
        for (const warning of result.warnings) {
          process.stderr.write(`    - ${warning}\n`);
        }
      }
      if (result.config.meta.beraterNr === 1001 || result.config.meta.mandantNr === 1) {
        process.stderr.write(
          '  ⚠ Berater-/Mandanten-Nr sind Platzhalter. Für den echten Import via --berater/--mandant setzen.\n',
        );
      }
      process.stderr.write(`\n${DISCLAIMER}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`✗ Fehler: ${message}\n`);
      process.exitCode = 1;
    }
  });

program.parse();
