import { describe, expect, it } from 'vitest';
import { MAX_TITLE_LENGTH, parseClassBody } from './body';

describe('parseClassBody', () => {
  it('reads a title, a grade and a roster', () => {
    expect(parseClassBody({ title: ' 7-А ', grade: 7, roster: [' Оля  ', 'Марко'] })).toEqual({
      title: '7-А',
      grade: 7,
      roster: ['Оля', 'Марко'],
      renames: undefined
    });
  });

  it('takes a missing grade as none', () => {
    expect(parseClassBody({ title: '7-А', roster: ['Оля'] })?.grade).toBeNull();
  });

  it('refuses a missing or too long title, a bad grade and a bad roster', () => {
    expect(parseClassBody(null)).toBeNull();
    expect(parseClassBody({ title: ' ', roster: ['Оля'] })).toBeNull();
    expect(parseClassBody({ title: 'x'.repeat(MAX_TITLE_LENGTH + 1), roster: ['Оля'] })).toBeNull();
    expect(parseClassBody({ title: '7-А', grade: 11, roster: ['Оля'] })).toBeNull();
    expect(parseClassBody({ title: '7-А', roster: [] })).toBeNull();
    expect(parseClassBody({ title: '7-А', roster: ['Оля', 'оля'] })).toBeNull();
  });
});
