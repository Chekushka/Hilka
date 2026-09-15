import { describe, expect, it } from 'vitest';
import { isValidSessionCode, normalizeSessionCode } from './code';

describe('normalizeSessionCode', () => {
  it('upper-cases', () => {
    expect(normalizeSessionCode('ab12cd')).toBe('AB12CD');
  });

  it('strips spaces from a code copy-pasted with breaks', () => {
    expect(normalizeSessionCode('AB 12 CD')).toBe('AB12CD');
  });

  it('strips dashes from a code shown grouped', () => {
    expect(normalizeSessionCode('AB1-2CD')).toBe('AB12CD');
  });

  it('leaves an already-clean code unchanged', () => {
    expect(normalizeSessionCode('ABC123')).toBe('ABC123');
  });
});

describe('isValidSessionCode', () => {
  it('accepts six upper-case letters and digits', () => {
    expect(isValidSessionCode('ABC123')).toBe(true);
    expect(isValidSessionCode('000000')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidSessionCode('ABC12')).toBe(false);
    expect(isValidSessionCode('ABC1234')).toBe(false);
    expect(isValidSessionCode('')).toBe(false);
  });

  it('rejects lower case and punctuation — normalize first', () => {
    expect(isValidSessionCode('abc123')).toBe(false);
    expect(isValidSessionCode('ABC-12')).toBe(false);
  });
});
