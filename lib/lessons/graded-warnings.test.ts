import { describe, expect, it } from 'vitest';
import { addLessonToSelection, findNonGradedTasks, type LessonPlacement } from './graded-warnings';

const mandatory: LessonPlacement = { kind: 'mandatory', coreTaskIds: ['m1', 'm2'], additionalTaskIds: ['m-extra'] };
const practice: LessonPlacement = { kind: 'practice', coreTaskIds: ['p1'], additionalTaskIds: ['p-extra'] };

describe('findNonGradedTasks', () => {
  it('passes core tasks of mandatory lessons', () => {
    expect(findNonGradedTasks(['m1', 'm2'], [mandatory, practice])).toEqual([]);
  });

  it('flags practice-lesson core tasks and additional tasks of either kind, in selection order', () => {
    expect(findNonGradedTasks(['p-extra', 'm1', 'p1', 'm-extra'], [mandatory, practice])).toEqual([
      { taskId: 'p-extra', reason: 'additional' },
      { taskId: 'p1', reason: 'practice-lesson' },
      { taskId: 'm-extra', reason: 'additional' }
    ]);
  });

  it('does not flag a task that is also core in some mandatory lesson', () => {
    const reused: LessonPlacement = { kind: 'practice', coreTaskIds: ['m1'], additionalTaskIds: ['m2'] };
    expect(findNonGradedTasks(['m1', 'm2'], [reused, mandatory])).toEqual([]);
  });

  it('does not flag a task that belongs to no lesson', () => {
    expect(findNonGradedTasks(['loose'], [mandatory, practice])).toEqual([]);
  });
});

describe('addLessonToSelection', () => {
  const all = new Set(['m1', 'm2', 'm-extra', 'p1']);

  it('appends core then additional tasks after what is already chosen', () => {
    expect(addLessonToSelection(['p1'], mandatory, all)).toEqual(['p1', 'm1', 'm2', 'm-extra']);
  });

  it('skips tasks already chosen, so adding a lesson twice is a no-op', () => {
    const once = addLessonToSelection([], mandatory, all);
    expect(addLessonToSelection(once, mandatory, all)).toEqual(once);
  });

  it('skips tasks that cannot be assigned', () => {
    expect(addLessonToSelection([], mandatory, new Set(['m2']))).toEqual(['m2']);
  });
});
