import { describe, expect, it } from 'vitest';
import { lessonTaskIds, resolveTaskSlugs, validateLessonContent, validateLessonImport } from './content';
import type { LessonContent } from './types';

const known = new Set(['a', 'b', 'c']);

function lesson(overrides: Partial<LessonContent> = {}): LessonContent {
  return {
    slug: 'g7-25-intro',
    grade: 7,
    order: 1,
    kind: 'mandatory',
    title: 'Вступ',
    coreTaskSlugs: ['a'],
    additionalTaskSlugs: [],
    ...overrides
  };
}

describe('validateLessonContent', () => {
  it('accepts well-formed lessons', () => {
    expect(
      validateLessonContent(
        [lesson(), lesson({ slug: 'g7-26', order: 2, kind: 'practice', coreTaskSlugs: ['b'], additionalTaskSlugs: ['c'] })],
        known
      )
    ).toEqual([]);
  });

  it('rejects an unknown task slug', () => {
    expect(validateLessonContent([lesson({ additionalTaskSlugs: ['zzz'] })], known)).toEqual([
      { lesson: 'g7-25-intro', message: 'unknown task "zzz"' }
    ]);
  });

  it('rejects a task listed twice in one lesson, even across core and additional', () => {
    const errors = validateLessonContent([lesson({ additionalTaskSlugs: ['a'] })], known);
    expect(errors.map((error) => error.message)).toEqual(['task "a" appears twice']);
  });

  it('allows the same task in two different lessons', () => {
    expect(validateLessonContent([lesson(), lesson({ slug: 'other', order: 2 })], known)).toEqual([]);
  });

  it('rejects duplicate slugs and duplicate order within a grade', () => {
    const messages = validateLessonContent([lesson(), lesson()], known).map((error) => error.message);
    expect(messages).toContain('duplicate slug');
    expect(messages).toContain('order 1 is used twice in grade 7');
  });

  it('allows the same order in different grades', () => {
    expect(validateLessonContent([lesson(), lesson({ slug: 'g8', grade: 8 })], known)).toEqual([]);
  });

  it('rejects an unknown kind, an empty title and a lesson with no core tasks', () => {
    const messages = validateLessonContent(
      [lesson({ kind: 'bonus' as LessonContent['kind'], title: ' ', coreTaskSlugs: [] })],
      known
    ).map((error) => error.message);
    expect(messages).toEqual(['invalid kind "bonus"', 'missing title', 'a lesson needs at least one core task']);
  });
});

describe('resolveTaskSlugs', () => {
  it('maps slugs to ids in order', () => {
    const ids = new Map([
      ['a', 'id-a'],
      ['b', 'id-b']
    ]);
    expect(resolveTaskSlugs(['b', 'a'], ids)).toEqual(['id-b', 'id-a']);
  });

  it('throws on an unknown slug', () => {
    expect(() => resolveTaskSlugs(['x'], new Map())).toThrow(/unknown task "x"/);
  });
});

describe('lessonTaskIds', () => {
  it('puts core tasks before additional ones', () => {
    expect(lessonTaskIds({ coreTaskIds: ['1', '2'], additionalTaskIds: ['3'] })).toEqual(['1', '2', '3']);
  });
});

describe('validateLessonImport', () => {
  const existing = [
    { slug: 'g7-25-intro', grade: 7, order: 1 },
    { slug: 'g7-26-vars', grade: 7, order: 2 }
  ];

  it('rejects a new lesson taking a number another lesson in the database holds', () => {
    const errors = validateLessonImport([lesson({ slug: 'g7-new', order: 2 })], existing, known);
    expect(errors).toEqual([{ lesson: 'g7-new', message: 'order 2 in grade 7 is already used by lesson "g7-26-vars"' }]);
  });

  it('allows re-importing a lesson over itself', () => {
    expect(validateLessonImport([lesson()], existing, known)).toEqual([]);
  });

  it('allows two imported lessons to swap numbers', () => {
    const swapped = [lesson({ order: 2 }), lesson({ slug: 'g7-26-vars', order: 1 })];
    expect(validateLessonImport(swapped, existing, known)).toEqual([]);
  });

  it('keeps every validateLessonContent rule', () => {
    expect(validateLessonImport([lesson({ slug: 'g7-new', order: 9, coreTaskSlugs: ['zzz'] })], existing, known)).toEqual([
      { lesson: 'g7-new', message: 'unknown task "zzz"' }
    ]);
  });
});
