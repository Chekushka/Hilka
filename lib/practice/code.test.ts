import { describe, expect, it } from 'vitest';
import { formatProgressCode, isValidProgressCode, normalizeProgressCode, PROGRESS_CODE_ALPHABET } from './code';

describe('normalizeProgressCode', () => {
  it('uppercases', () => {
    expect(normalizeProgressCode('abcdefgh')).toBe('ABCDEFGH');
  });

  it('strips dashes and spaces', () => {
    expect(normalizeProgressCode('ABCD-EFGH')).toBe('ABCDEFGH');
    expect(normalizeProgressCode('ABCD EFGH')).toBe('ABCDEFGH');
  });

  it('treats every input form of the same code identically', () => {
    const forms = ['abcd-efgh', 'ABCD-EFGH', 'abcdefgh', ' abcd efgh '];
    const normalized = new Set(forms.map((form) => normalizeProgressCode(form.trim())));
    expect(normalized.size).toBe(1);
  });
});

describe('isValidProgressCode', () => {
  it('accepts a code entirely from the alphabet at the right length', () => {
    expect(isValidProgressCode('ABCDEFGH')).toBe(true);
  });

  it('rejects the wrong length', () => {
    expect(isValidProgressCode('ABCDEFG')).toBe(false);
    expect(isValidProgressCode('ABCDEFGHI'.slice(0, 9))).toBe(false);
  });

  it('rejects the ambiguous characters the alphabet deliberately excludes', () => {
    for (const excluded of ['0', 'O', '1', 'I', 'L']) {
      expect(isValidProgressCode(`ABCDEFG${excluded}`)).toBe(false);
    }
  });

  it('never excludes a character actually in the alphabet', () => {
    for (const char of PROGRESS_CODE_ALPHABET) {
      expect(isValidProgressCode(char.repeat(8))).toBe(true);
    }
  });
});

describe('formatProgressCode', () => {
  it('groups into two four-character halves', () => {
    expect(formatProgressCode('ABCDEFGH')).toBe('ABCD-EFGH');
  });
});
