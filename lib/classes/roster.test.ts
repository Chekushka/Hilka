import { describe, expect, it } from 'vitest';
import {
  MAX_ROSTER_SIZE,
  addNames,
  cleanGrade,
  cleanStudents,
  findStudent,
  nameKey,
  newStudentId,
  normalizeName,
  parseNames,
  readName,
  seedKeyOf,
  sortRoster,
  type RosterStudent
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

describe('seedKeyOf', () => {
  it('seeds a student from their id, or from the name they had before ids existed', () => {
    expect(seedKeyOf({ id: 'a1b2c3d4e5f6' })).toBe('a1b2c3d4e5f6');
    expect(seedKeyOf({ id: 'a1b2c3d4e5f6', seed: 'Оля' })).toBe('Оля');
  });
});

describe('newStudentId', () => {
  it('is 12 lowercase hex characters', () => {
    expect(newStudentId(() => 'ABCDEF01-2345-6789-abcd-ef0123456789')).toBe('abcdef012345');
    expect(newStudentId()).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('cleanStudents', () => {
  const stored: RosterStudent[] = [
    { id: 'aaaaaaaaaaaa', name: 'Оля', seed: 'Оля' },
    { id: 'bbbbbbbbbbbb', name: 'Марко' }
  ];
  const ids = (...list: string[]) => {
    const queue = [...list];
    return () => queue.shift() ?? 'zzzzzzzzzzzz';
  };

  it('keeps stored entries by id, seed included, and renames them in place', () => {
    expect(cleanStudents([{ id: 'aaaaaaaaaaaa', name: ' Ольга ' }, { id: 'bbbbbbbbbbbb', name: 'Марко' }], stored)).toEqual([
      { id: 'aaaaaaaaaaaa', name: 'Ольга', seed: 'Оля' },
      { id: 'bbbbbbbbbbbb', name: 'Марко' }
    ]);
  });

  it('mints an id for a new name, never one already taken', () => {
    expect(cleanStudents([{ name: 'Іван' }], stored, ids('aaaaaaaaaaaa', 'cccccccccccc'))).toEqual([
      { id: 'cccccccccccc', name: 'Іван' }
    ]);
  });

  it('ignores a seed sent by the client', () => {
    expect(cleanStudents([{ name: 'Іван', seed: 'Оля' }], stored, ids('cccccccccccc'))).toEqual([
      { id: 'cccccccccccc', name: 'Іван' }
    ]);
  });

  it('refuses an unknown or repeated id, repeated names, blanks and bad shapes', () => {
    expect(cleanStudents([{ id: 'dddddddddddd', name: 'Іван' }], stored)).toBeNull();
    expect(cleanStudents([{ id: 'aaaaaaaaaaaa', name: 'Оля' }, { id: 'aaaaaaaaaaaa', name: 'Олька' }], stored)).toBeNull();
    expect(cleanStudents([{ name: 'Оля' }, { name: 'оля' }], [])).toBeNull();
    expect(cleanStudents([{ name: '  ' }], [])).toBeNull();
    expect(cleanStudents(['Оля'], [])).toBeNull();
    expect(cleanStudents([], [])).toBeNull();
    expect(cleanStudents(Array.from({ length: MAX_ROSTER_SIZE + 1 }, (_, i) => ({ name: `Учень ${i}` })), [])).toBeNull();
  });
});

describe('findStudent', () => {
  const roster = [
    { id: 'aaaaaaaaaaaa', name: 'Оля' },
    { id: 'bbbbbbbbbbbb', name: 'Марко' }
  ];

  it('finds a student by id, never by name', () => {
    expect(findStudent(roster, 'bbbbbbbbbbbb')?.name).toBe('Марко');
    expect(findStudent(roster, 'Оля')).toBeNull();
  });

  it('finds no one for nothing or a stranger', () => {
    expect(findStudent(roster, null)).toBeNull();
    expect(findStudent(roster, '')).toBeNull();
    expect(findStudent(roster, 'Хтось')).toBeNull();
  });
});
