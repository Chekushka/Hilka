import { describe, expect, it } from 'vitest';
import { MAX_TITLE_LENGTH, parseClassBody, readStudents } from './body';

describe('parseClassBody', () => {
  it('reads a title and a grade, leaving the students for later', () => {
    expect(parseClassBody({ title: ' 7-А ', grade: 7, students: [{ name: 'Оля' }] })).toEqual({
      title: '7-А',
      grade: 7,
      students: [{ name: 'Оля' }]
    });
  });

  it('takes a missing grade as none', () => {
    expect(parseClassBody({ title: '7-А', students: [] })?.grade).toBeNull();
  });

  it('refuses a missing or too long title and a bad grade', () => {
    expect(parseClassBody(null)).toBeNull();
    expect(parseClassBody({ title: ' ' })).toBeNull();
    expect(parseClassBody({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1) })).toBeNull();
    expect(parseClassBody({ title: '7-А', grade: 11 })).toBeNull();
  });
});

describe('readStudents', () => {
  const stored = [{ id: 'aaaaaaaaaaaa', name: 'Оля', seed: 'Оля' }];

  it('checks the students against the stored roster', () => {
    const body = parseClassBody({ title: '7-А', students: [{ id: 'aaaaaaaaaaaa', name: 'Ольга' }, { name: 'Іван' }] })!;
    expect(readStudents(body, stored, () => 'bbbbbbbbbbbb')).toEqual([
      { id: 'aaaaaaaaaaaa', name: 'Ольга', seed: 'Оля' },
      { id: 'bbbbbbbbbbbb', name: 'Іван' }
    ]);
    expect(readStudents(parseClassBody({ title: '7-А', students: [] })!, stored)).toBeNull();
  });
});
