import { describe, expect, it } from 'vitest';
import {
  MAX_ROSTER_SIZE,
  addNames,
  cleanGrade,
  cleanRenames,
  cleanRoster,
  nameKey,
  normalizeName,
  parseNames,
  readName,
  sortRoster
} from './roster';

describe('normalizeName', () => {
  it('trims and collapses spaces', () => {
    expect(normalizeName('  Петренко   Іван ')).toBe('Петренко Іван');
  });

  it('never rewrites a stored name beyond its spacing', () => {
    expect(normalizeName('1. Оля')).toBe('1. Оля');
  });
});

describe('readName', () => {
  it('drops a list number in front of typed or pasted input', () => {
    expect(readName('1. Петренко Іван')).toBe('Петренко Іван');
    expect(readName('12) Оля')).toBe('Оля');
    expect(readName('№3 Марко')).toBe('Марко');
    expect(readName(' 4 - Ліна')).toBe('Ліна');
  });

  it('keeps a name that is not numbered', () => {
    expect(readName("Мар'яна")).toBe("Мар'яна");
  });
});

describe('nameKey', () => {
  it('ignores case and spacing', () => {
    expect(nameKey('ІВАН  петренко')).toBe(nameKey('Іван Петренко'));
  });
});

describe('parseNames', () => {
  it('reads one name per line, skipping blank lines', () => {
    expect(parseNames('Оля\n\n  Марко \r\nІван')).toEqual(['Оля', 'Марко', 'Іван']);
  });

  it('splits a line on commas and semicolons', () => {
    expect(parseNames('Оля, Марко; Іван')).toEqual(['Оля', 'Марко', 'Іван']);
  });

  it('reads a spreadsheet row as one student, without its row number', () => {
    expect(parseNames('1\tПетренко\tІван\n2.\tКоваль\tОля')).toEqual(['Петренко Іван', 'Коваль Оля']);
  });

  it('drops journal numbering', () => {
    expect(parseNames('1. Оля\n2. Марко')).toEqual(['Оля', 'Марко']);
  });
});

describe('addNames', () => {
  it('appends new names and skips ones already there, whatever their case', () => {
    const result = addNames(['Оля'], ['оля', 'Марко', 'Марко ']);
    expect(result.roster).toEqual(['Оля', 'Марко']);
    expect(result.added).toEqual(['Марко']);
    expect(result.skipped).toEqual(['оля', 'Марко']);
  });
});

describe('sortRoster', () => {
  it('sorts in Ukrainian alphabetical order', () => {
    expect(sortRoster(['Їжак', 'Іван', 'Єва', 'Ева', 'Ґанна', 'Галя'])).toEqual([
      'Галя',
      'Ґанна',
      'Ева',
      'Єва',
      'Іван',
      'Їжак'
    ]);
  });

  it('leaves the original untouched', () => {
    const roster = ['Б', 'А'];
    sortRoster(roster);
    expect(roster).toEqual(['Б', 'А']);
  });
});

describe('cleanRoster', () => {
  it('normalizes a valid roster', () => {
    expect(cleanRoster([' Оля ', 'Марко'])).toEqual(['Оля', 'Марко']);
  });

  it('refuses empty, non-string, blank and repeated entries', () => {
    expect(cleanRoster([])).toBeNull();
    expect(cleanRoster('Оля')).toBeNull();
    expect(cleanRoster(['Оля', 3])).toBeNull();
    expect(cleanRoster(['Оля', '  '])).toBeNull();
    expect(cleanRoster(['Оля', 'оля'])).toBeNull();
  });

  it('refuses a roster over the limit', () => {
    expect(cleanRoster(Array.from({ length: MAX_ROSTER_SIZE + 1 }, (_, i) => `Учень ${i}`))).toBeNull();
  });
});

describe('cleanGrade', () => {
  it('accepts a curriculum grade or nothing', () => {
    expect(cleanGrade(8)).toBe(8);
    expect(cleanGrade(null)).toBeNull();
    expect(cleanGrade(undefined)).toBeNull();
    expect(cleanGrade('')).toBeNull();
  });

  it('refuses anything else', () => {
    expect(cleanGrade(5)).toBeUndefined();
    expect(cleanGrade('8')).toBeUndefined();
  });
});

describe('cleanRenames', () => {
  const before = ['Оля', 'Марко', 'Іван'];

  it('accepts a rename from an old name to a new one', () => {
    expect(cleanRenames([{ from: 'Марко', to: 'Марк' }], before, ['Оля', 'Марк', 'Іван'])).toEqual([
      { from: 'Марко', to: 'Марк' }
    ]);
  });

  it('accepts fixing only the case of a name', () => {
    expect(cleanRenames([{ from: 'Оля', to: 'ОЛЯ' }], before, ['ОЛЯ', 'Марко', 'Іван'])).toEqual([
      { from: 'Оля', to: 'ОЛЯ' }
    ]);
  });

  it('treats a missing list as no renames and skips a rename to the same name', () => {
    expect(cleanRenames(undefined, before, before)).toEqual([]);
    expect(cleanRenames([{ from: 'Оля', to: 'Оля' }], before, before)).toEqual([]);
  });

  it('refuses to merge two students', () => {
    expect(cleanRenames([{ from: 'Марко', to: 'Оля' }], before, ['Оля', 'Іван'])).toBeNull();
  });

  it('refuses a rename whose old name stays or whose new name is missing', () => {
    expect(cleanRenames([{ from: 'Марко', to: 'Марк' }], before, ['Оля', 'Марко', 'Марк', 'Іван'])).toBeNull();
    expect(cleanRenames([{ from: 'Марко', to: 'Марк' }], before, ['Оля', 'Іван'])).toBeNull();
  });

  it('refuses a name not on the old roster, and renaming twice', () => {
    expect(cleanRenames([{ from: 'Хтось', to: 'Марк' }], before, ['Оля', 'Марк', 'Іван', 'Марко'])).toBeNull();
    expect(
      cleanRenames(
        [
          { from: 'Марко', to: 'Марк' },
          { from: 'Марко', to: 'Марічка' }
        ],
        before,
        ['Оля', 'Марк', 'Марічка', 'Іван']
      )
    ).toBeNull();
  });

  it('refuses malformed input', () => {
    expect(cleanRenames('Марко', before, before)).toBeNull();
    expect(cleanRenames([{ from: 'Марко' }], before, before)).toBeNull();
  });
});
