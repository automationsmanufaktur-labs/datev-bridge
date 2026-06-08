import { describe, expect, it } from 'vitest';
import { encodeCp1252 } from '../src/writer/encoding';

describe('encodeCp1252', () => {
  it('encodes ASCII unchanged', () => {
    expect([...encodeCp1252('ABC123')]).toEqual([65, 66, 67, 49, 50, 51]);
  });

  it('encodes German umlauts as single Latin-1 bytes', () => {
    expect([...encodeCp1252('üäöÜÄÖß')]).toEqual([0xfc, 0xe4, 0xf6, 0xdc, 0xc4, 0xd6, 0xdf]);
  });

  it('encodes the Euro sign as 0x80 (CP-1252, not Latin-1)', () => {
    expect([...encodeCp1252('€')]).toEqual([0x80]);
  });

  it('encodes the en dash as 0x96', () => {
    expect([...encodeCp1252('–')]).toEqual([0x96]);
  });

  it('replaces characters outside CP-1252 with "?"', () => {
    expect([...encodeCp1252('😀')]).toEqual([0x3f]);
  });

  it('never produces UTF-8 multibyte sequences for umlauts', () => {
    const buffer = encodeCp1252('Büro');
    expect(buffer.indexOf(Buffer.from([0xc3, 0xbc]))).toBe(-1);
    expect(buffer.includes(0xfc)).toBe(true);
  });
});
