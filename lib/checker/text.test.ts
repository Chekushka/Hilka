import { describe, expect, it } from 'vitest';
import { extractNumbers, lastLine, normalizeText } from './text';

describe('normalizeText', () => {
  it('trims only when asked', () => {
    expect(normalizeText('  ага  ')).toBe('  ага  ');
    expect(normalizeText('  ага  ', 'trim')).toBe('ага');
  });

  it('forgives a double space and a capital letter in loose mode', () => {
    expect(normalizeText(' Привіт   Світ ', 'loose')).toBe('привіт світ');
  });
});

describe('lastLine', () => {
  it('ignores the trailing newline print leaves behind', () => {
    expect(lastLine('перший\nостанній\n')).toBe('останній');
  });

  it('handles output with no newline at all', () => {
    expect(lastLine('22.86')).toBe('22.86');
  });
});

describe('extractNumbers', () => {
  it('reads a decimal comma as a decimal point', () => {
    // A student who writes 22,86 is not wrong.
    expect(extractNumbers('ІМТ: 22,86')).toEqual([22.86]);
  });

  it('splits on a comma used as a list separator', () => {
    expect(extractNumbers('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it('reads negatives', () => {
    expect(extractNumbers('температура -7 градусів')).toEqual([-7]);
  });

  it('returns nothing for output with no numbers', () => {
    expect(extractNumbers('нічого')).toEqual([]);
  });
});
