/**
 * Windows-1252 (CP-1252) encoder. DATEV expects this single-byte encoding for
 * EXTF files. CP-1252 is the correct choice over plain ISO-8859-1 because it
 * carries the Euro sign (€ = 0x80) which Latin-1 lacks. We implement it without
 * a dependency so the byte mapping is explicit and testable.
 *
 * Bytes 0x00–0x7F and 0xA0–0xFF map 1:1 to the same Unicode code points
 * (Latin-1 range). The 0x80–0x9F range holds the CP-1252 specials below.
 * Anything not representable becomes "?" (0x3F).
 */

/** Unicode code point -> CP-1252 byte, for the 0x80–0x9F special range. */
const CP1252_SPECIALS: Record<number, number> = {
  0x20ac: 0x80, // €
  0x201a: 0x82, // ‚
  0x0192: 0x83, // ƒ
  0x201e: 0x84, // „
  0x2026: 0x85, // …
  0x2020: 0x86, // †
  0x2021: 0x87, // ‡
  0x02c6: 0x88, // ˆ
  0x2030: 0x89, // ‰
  0x0160: 0x8a, // Š
  0x2039: 0x8b, // ‹
  0x0152: 0x8c, // Œ
  0x017d: 0x8e, // Ž
  0x2018: 0x91, // ‘
  0x2019: 0x92, // ’
  0x201c: 0x93, // “
  0x201d: 0x94, // ”
  0x2022: 0x95, // •
  0x2013: 0x96, // –
  0x2014: 0x97, // —
  0x02dc: 0x98, // ˜
  0x2122: 0x99, // ™
  0x0161: 0x9a, // š
  0x203a: 0x9b, // ›
  0x0153: 0x9c, // œ
  0x017e: 0x9e, // ž
  0x0178: 0x9f, // Ÿ
};

const REPLACEMENT = 0x3f; // '?'

export function encodeCp1252(text: string): Buffer {
  const bytes: number[] = [];
  for (const char of text) {
    const cp = char.codePointAt(0);
    if (cp === undefined) continue;
    if (cp <= 0x7f || (cp >= 0xa0 && cp <= 0xff)) {
      bytes.push(cp);
      continue;
    }
    const special = CP1252_SPECIALS[cp];
    bytes.push(special ?? REPLACEMENT);
  }
  return Buffer.from(bytes);
}
