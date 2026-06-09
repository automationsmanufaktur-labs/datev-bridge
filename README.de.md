<div align="center">

<img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/banner.svg" alt="datev-bridge — Stripe-CSV zu DATEV-EXTF-Buchungsstapel" width="100%" />

<p>
  <a href="https://www.npmjs.com/package/datev-bridge"><img src="https://img.shields.io/npm/v/datev-bridge?color=3FB950&amp;label=npm" alt="npm version" /></a>
  <a href="https://github.com/automationsmanufaktur-labs/datev-bridge/actions/workflows/ci.yml"><img src="https://github.com/automationsmanufaktur-labs/datev-bridge/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >= 18" />
</p>

<strong>CSV-Exporte aus Payment-Tools in einen DATEV-EXTF-Buchungsstapel umwandeln</strong><br />
adapter-basiert, mit deklarativem, versionierbarem Mapping. Heute Stripe; PayPal, Shopify, Bank-CSV als Nächstes.

[English](README.md) · **Deutsch**

</div>

```bash
npx datev-bridge stripe-export.csv -o buchungsstapel.csv
```

<p align="center">
  <img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/terminal.svg" alt="Terminal-Demo: 7 Buchungen aus 5 Transaktionen, Soll = Haben Check" width="760" />
</p>

---

> [!IMPORTANT]
> **datev-bridge ist _format-kompatibel_ mit dem DATEV-EXTF-Import — es ist kein DATEV-Produkt, nicht DATEV-zertifiziert und gibt keine GoBD-Garantie.** Die Konten- und Steuerschlüssel-Defaults bilden die übliche deutsche Praxis für Stripe ab, **müssen aber von deinem Steuerberater** für deine konkrete Situation bestätigt werden (Kleinunternehmer, Reverse-Charge-Behandlung, Kontenrahmen-Einrichtung). Du bleibst verantwortlich für das, was du importierst.

## Warum

Stripe (und Co.) exportieren CSVs; DATEV importiert den EXTF-„Buchungsstapel". Beides korrekt zu verbinden ist fummelig: Ein Stripe-**Payout ist kein Erlös** (Stripe verhält sich wie ein Bankkonto / Geldtransit), die **Gebühren sind eine EU-Reverse-Charge-Leistung (§13b UStG)**, weil Stripe aus Irland abrechnet, und DATEV importiert nur, wenn die Datei byte-korrekt ist (ISO-8859-1/Windows-1252, Semikolons, CRLF, Komma-Dezimalstellen, die richtige Spaltenreihenfolge).

Die existierenden Open-Source-Tools ziehen entweder über die **API** (braucht Keys) oder sind reine **Format-Writer** ohne Quell-Mapping, und das einzige mit echtem Mapping ist Single-Source-Python. **datev-bridge füllt die offene Nische: ein OSS-, CSV-basiertes (kein API-Key), Node-/`npx`-CLI mit Quell-Adapter-Architektur und Code-as-Config-Mapping, das du in git versionieren kannst.**

## Was es macht

<p align="center">
  <img src="https://raw.githubusercontent.com/automationsmanufaktur-labs/datev-bridge/main/assets/pipeline.svg" alt="Pipeline: Stripe-CSV → Adapter → Transaction[] → Mapping + YAML → Booking[] → EXTF-Writer → buchungsstapel.csv" width="100%" />
</p>

- **Quell-Adapter** normalisieren das CSV eines Anbieters in ein anbieter-agnostisches Transaktionsmodell. Neue Quelle = ein neuer Adapter.
- **Deklaratives Mapping** (YAML, mit Zod validiert) hält deine Konten und Steuerschlüssel — nichts ist hartkodiert.
- **EXTF-Writer** erzeugt einen spec-korrekten Buchungsstapel: 31-Feld-Vorlauf-Header, 125 Datenspalten, Windows-1252-Encoding, CRLF, Komma-Dezimalstellen, `TTMM`-Belegdatum, positiver Umsatz mit explizitem Soll/Haben.

## Installation

```bash
# einmalig
npx datev-bridge --help

# oder global installieren
npm i -g datev-bridge
```

Voraussetzung: Node.js >= 18.

## Benutzung

```bash
datev-bridge <input.csv> [options]

Options:
  -o, --output <file>     EXTF-Ausgabedatei                (default: buchungsstapel.csv)
  -a, --adapter <id>      Quell-Adapter                    (default: stripe)
  -c, --config <file>     YAML-Mapping (über das SKR-Preset gemerged)
      --skr <skr>         SKR03 | SKR04
      --berater <nr>      DATEV-Berater-Nr (>= 1001)
      --mandant <nr>      DATEV-Mandanten-Nr
      --bezeichnung <txt> in DATEV angezeigtes Stapel-Label
      --stdout            Bytes nach stdout statt in eine Datei schreiben
```

### Den richtigen Stripe-Export holen

Im Stripe-Dashboard → **Reports → Balance → „Balance change from activity"** den **Itemized**-Report für deinen Zeitraum exportieren. Dieser Report listet jede Geldbewegung (Charges, Fees, Refunds, Payouts) — genau das, was du für vollständige Buchhaltung brauchst. (Siehe [Stripe-Docs](https://docs.stripe.com/reports/report-types/balance).)

### Beispiel

```bash
datev-bridge stripe-itemized-2026-01.csv \
  -o buchungsstapel-2026-01.csv \
  -c my-mapping.yaml \
  --berater 12345 --mandant 678
```

## Wie die Buchung funktioniert (schlankes & korrektes Modell)

Stripe wird als **Geldtransit-/Verrechnungskonto** behandelt — ein Payout ist ein Transfer auf dein Bankkonto, kein Erlös. Defaults für **SKR03** (SKR04 in Klammern):

| Transaktion        | Soll                 | Haben                 | Steuerschlüssel | Hinweis |
|--------------------|----------------------|-----------------------|-----------------|---------|
| Verkauf (Charge)   | Geldtransit 1360 (1460) | Erlöse 19% 8400 (4400) | — automatisch | brutto; DATEV leitet die USt ab |
| Stripe-Gebühr      | Gebühren 4970 (6855) | Geldtransit 1360 (1460) | **506** | §13b Reverse Charge EU 19% |
| Erstattung (Refund)| Erlöse 19% 8400 (4400) | Geldtransit 1360 (1460) | — automatisch | storniert den Verkauf |
| Payout aufs Bankkonto | Bank 1200 (1800)  | Geldtransit 1360 (1460) | — | Geld verlässt Stripe |

Zwei Defaults sind die üblichen Fehlerquellen, und beide werden hier sauber gelöst:

1. **Geldtransit-Prinzip** — den Payout (statt der einzelnen Verkäufe) als Erlös zu buchen, ist falsch. Verkäufe treffen den Erlös; der Payout bewegt nur den Netto-Betrag aufs Bankkonto.
2. **§13b auf Gebühren** — Stripe Payments Europe rechnet aus Irland ab, also ist die Gebühr eine Reverse-Charge-Leistung. Der Default-Schlüssel ist **506** (§13b EU 19%), *nicht* der generische BU 94, der bei jeder Buchung eine manuelle EU-Auswahl erzwingen würde.

> All das ist im YAML-Mapping konfigurierbar, und all das sollte von deinem Steuerberater bestätigt werden.

## Konfiguration

Starte von einem Preset und überschreibe nur, was abweicht. Siehe [`configs/stripe-skr03.example.yaml`](./configs/stripe-skr03.example.yaml) und [`configs/stripe-skr04.example.yaml`](./configs/stripe-skr04.example.yaml).

```yaml
meta:
  skr: SKR03
  beraterNr: 12345        # für einen echten Import erforderlich
  mandantNr: 678
  sachkontenlaenge: 4     # muss zur DATEV-Mandanten-Einrichtung passen
  festschreibung: 0       # 0 = Berater prüft vor dem Festschreiben
accounts:
  geldtransit: 1360
  bank: 1200
  revenue19: 8400
  revenue7: 8300
  fees: 4970
taxKeys:
  revenue19: ""           # Automatikkonto → leer
  fees: "506"             # §13b Reverse Charge EU 19%
options:
  defaultVatRate: "19"
```

Ohne `-c` werden die eingebauten SKR03-Defaults verwendet (mit Platzhalter-Berater-/Mandanten-Nummern und einer Warnung).

## Unterstützte Transaktionen & Grenzen

**Aktuell unterstützt:** Charge (Erlös + Gebühr), Refund, eigenständige Stripe-Gebühr, Payout.

**Noch nicht (wird mit Warnung übersprungen, nie still falsch gebucht):** Disputes/Chargebacks, Balance-Adjustments, Fremdwährungs-Kursdifferenzen, Per-Position-USt-Erkennung (das MVP wendet einen Default-USt-Satz an), Debitoren-Nebenbuch und pRAP-Periodenabgrenzung. Die stehen auf der [Roadmap](#roadmap).

Jeder Export muss ein **einzelnes Wirtschaftsjahr** abdecken — EXTF speichert das Belegdatum als `TTMM` ohne Jahr, daher verweigert datev-bridge eine jahres-gemischte Datei, statt zu raten.

> [!NOTE]
> **Kleinunternehmer (§19 UStG):** Die Defaults gehen von einem umsatzsteuerpflichtigen Unternehmen mit vollem Vorsteuerabzug aus, sodass der §13b Reverse Charge auf Stripe-Gebühren auf null saldiert. Nutzt du die §19-Kleinunternehmerregelung, gilt §13b weiterhin, aber die selbst berechnete USt wird zu echten Kosten (kein Vorsteuerabzug), und Erlöse werden ohne USt gebucht — passe das Mapping entsprechend an und bestätige es mit deinem Steuerberater.

## Als Library nutzen

```ts
import { convert } from 'datev-bridge';
import { readFileSync } from 'node:fs';

const { buffer, bookingCount, warnings } = convert({
  csv: readFileSync('stripe-export.csv', 'utf8'),
  overrides: { skr: 'SKR04', beraterNr: 12345, mandantNr: 678 },
});
writeFileSync('buchungsstapel.csv', buffer); // CP-1252-Bytes
```

## Roadmap

- [ ] PayPal-, Shopify-Payments- und generische Bank-CSV-Adapter
- [ ] Fremdwährungs-Kursdifferenz-Behandlung
- [ ] Per-Position-USt-Erkennung (Steuer-Spalten / Metadaten)
- [ ] Dispute-/Chargeback-Buchungen
- [ ] Optionale pRAP-Periodenabgrenzung für Abos
- [ ] Debitoren-Nebenbuch-Buchungen

## Mitmachen

Neue Quell-Adapter sind sehr willkommen — genau dafür ist die Architektur da. Siehe [CONTRIBUTING.md](./CONTRIBUTING.md) und den [Adapter-Guide](./docs/ADAPTERS.md).

## Entwicklung

```bash
npm install
npm run check      # Typecheck + Lint + Test
npm run build      # Bundle nach dist/ via tsup
```

## Danksagung

Format und Mapping gegen das offene, MIT-lizenzierte
[`ledermann/datev`](https://github.com/ledermann/datev) (EXTF-Referenz) und
[`jonaswitt/stripe-datev-exporter`](https://github.com/jonaswitt/stripe-datev-exporter)
(Stripe-Buchungslogik) gegengeprüft. Die DATEV-Feldsemantik ist aus der
öffentlichen [Formatbeschreibung](https://developer.datev.de/de/file-format)
neu implementiert, nicht kopiert.

## Lizenz

[MIT](./LICENSE) © Julian Abt. „DATEV" ist eine Marke der DATEV eG; dieses Projekt ist unabhängig und steht in keiner Verbindung zu DATEV und wird von DATEV nicht unterstützt.
