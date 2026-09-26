import { describe, expect, it } from 'vitest';
import {
  isLessonDraftShaped,
  nextLessonOrder,
  normalizeLessonDraft,
  validateLessonDraft,
  type LessonDraft,
  type LessonDraftContext
} from './authoring';

function draft(overrides: Partial<LessonDraft> = {}): LessonDraft {
  return {
    slug: 'g8-1-lists',
    grade: 8,
    order: 1,
    kind: 'mandatory',
    title: 'Списки',
    curriculumRef: null,
    explanationMd: '',
    coreTaskIds: ['t1'],
    additionalTaskIds: [],
    ...overrides
  };
}

const context: LessonDraftContext = {
  lessons: [
    { id: 'l1', slug: 'g7-25-intro', grade: 7, order: 25 },
    { id: 'l2', slug: 'g8-2-loops', grade: 8, order: 2 }
  ],
  knownTaskIds: new Set(['t1', 't2', 't3'])
};

describe('validateLessonDraft', () => {
  it('accepts a complete lesson', () => {
    expect(validateLessonDraft(draft(), context)).toEqual([]);
  });

  it('rejects a slug a git export could not key on', () => {
    expect(validateLessonDraft(draft({ slug: 'Урок 1' }), context)).toEqual(['slug']);
    expect(validateLessonDraft(draft({ slug: '' }), context)).toEqual(['slug']);
    expect(validateLessonDraft(draft({ slug: 'a--b' }), context)).toEqual(['slug']);
  });

  it('rejects a slug another lesson has', () => {
    expect(validateLessonDraft(draft({ slug: 'g7-25-intro' }), context)).toEqual(['slugTaken']);
  });

  it('rejects a ministry number already used in the same grade, but not in another grade', () => {
    expect(validateLessonDraft(draft({ order: 2 }), context)).toEqual(['orderTaken']);
    expect(validateLessonDraft(draft({ grade: 9, order: 2 }), context)).toEqual([]);
  });

  it('does not collide with itself when editing', () => {
    const editing = { ...context, editingId: 'l2' };
    expect(validateLessonDraft(draft({ slug: 'g8-2-loops', order: 2 }), editing)).toEqual([]);
  });

  it('needs at least one core task', () => {
    expect(validateLessonDraft(draft({ coreTaskIds: [], additionalTaskIds: ['t1'] }), context)).toEqual(['noCoreTask']);
  });

  it('rejects a task that does not exist, or appears twice', () => {
    expect(validateLessonDraft(draft({ coreTaskIds: ['t1', 'zzz'] }), context)).toEqual(['unknownTask']);
    expect(validateLessonDraft(draft({ coreTaskIds: ['t1'], additionalTaskIds: ['t1'] }), context)).toEqual([
      'duplicateTask'
    ]);
  });

  it('rejects an invalid grade, order, kind and an empty title', () => {
    const errors = validateLessonDraft(
      draft({ grade: 0, order: 1.5, kind: 'bonus' as LessonDraft['kind'], title: '  ' }),
      context
    );
    expect(errors).toEqual(['grade', 'order', 'kind', 'title']);
  });
});

describe('isLessonDraftShaped', () => {
  it('accepts a well-formed body', () => {
    expect(isLessonDraftShaped(draft())).toBe(true);
  });

  it('rejects a body with a wrong-typed field', () => {
    expect(isLessonDraftShaped({ ...draft(), coreTaskIds: [1] })).toBe(false);
    expect(isLessonDraftShaped({ ...draft(), grade: '8' })).toBe(false);
    expect(isLessonDraftShaped(null)).toBe(false);
  });
});

describe('normalizeLessonDraft', () => {
  it('trims and stores an empty curriculum reference as null', () => {
    expect(normalizeLessonDraft(draft({ slug: ' g8-1 ', title: ' Списки ', curriculumRef: '  ' }))).toMatchObject({
      slug: 'g8-1',
      title: 'Списки',
      curriculumRef: null
    });
  });
});

describe('nextLessonOrder', () => {
  it('is one past the highest number in that grade, or 1 in an empty grade', () => {
    expect(nextLessonOrder(context.lessons, 7)).toBe(26);
    expect(nextLessonOrder(context.lessons, 9)).toBe(1);
  });
});
