import { describe, expect, it } from 'vitest';
import { isCompleteSessionCode, normalizeSessionCode, SESSION_CODE_LENGTH } from './code';

describe('normalizeSessionCode', () => {
  it('upper-cases what was typed', () => {
    expect(normalizeSessionCode('k7pq2x')).toBe('K7PQ2X');
  });

  it('turns Cyrillic lookalikes into the Latin letters on the projector', () => {
    // «РАСКМН» typed on a Ukrainian layout, every letter Cyrillic.
    expect(normalizeSessionCode('РАСКМН')).toBe('PACKMH');
    expect(normalizeSessionCode('вех')).toBe('BEX');
  });

  it('drops spaces, dashes and other separators', () => {
    expect(normalizeSessionCode(' K7P-Q2X ')).toBe('K7PQ2X');
  });

  it('drops Cyrillic letters that look like nothing Latin', () => {
    expect(normalizeSessionCode('ЖK7')).toBe('K7');
  });

  it('keeps characters minting avoids, so an older code still works', () => {
    expect(normalizeSessionCode('demo01')).toBe('DEMO01');
  });

  it('never grows past the code length', () => {
    expect(normalizeSessionCode('ABCDEFGH')).toHaveLength(SESSION_CODE_LENGTH);
  });
});

describe('isCompleteSessionCode', () => {
  it('is true only at the full length', () => {
    expect(isCompleteSessionCode('K7PQ2')).toBe(false);
    expect(isCompleteSessionCode('K7PQ2X')).toBe(true);
  });
});
