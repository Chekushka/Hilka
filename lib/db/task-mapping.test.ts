import { describe, expect, it } from 'vitest';
import { toCodeTask, type TaskRow } from './task-mapping';

function row(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    slug: 'g7-turtle-square',
    topicId: '00000000-0000-4000-8000-000000000002',
    type: 'code',
    title: 'Квадрат',
    payload: { type: 'code', surface: 'turtle', prompt: 'Намалюй квадрат.', starter: '' },
    checks: [{ kind: 'shape_props', closed: true }],
    cases: null,
    reference: { code: 'import turtle' },
    hints: ['перша'],
    params: null,
    difficulty: 2,
    gradeTags: [7],
    version: 3,
    status: 'published',
    ...overrides
  };
}

describe('toCodeTask', () => {
  it('maps a published row to the task the workspace consumes', () => {
    const task = toCodeTask(row());
    expect(task).not.toBeNull();
    expect(task?.slug).toBe('g7-turtle-square');
    expect(task?.payload.surface).toBe('turtle');
    expect(task?.reference.code).toBe('import turtle');
    expect(task?.version).toBe(3);
  });

  it('rejects a row whose type is not code', () => {
    expect(toCodeTask(row({ type: 'quiz' }))).toBeNull();
  });

  it('rejects a row whose payload disagrees with its type', () => {
    // jsonb is not type-checked by the database; a mismatch must stop here
    // rather than reaching the editor.
    const broken = row();
    broken.payload = { type: 'quiz' } as unknown as TaskRow['payload'];
    expect(toCodeTask(broken)).toBeNull();
  });

  it('rejects a Python task with no reference solution', () => {
    // Expected results are computed by running the reference (CLAUDE.md rule
    // 5). Without one the target drawing cannot exist.
    expect(toCodeTask(row({ reference: null }))).toBeNull();
    expect(toCodeTask(row({ reference: { code: '' } }))).toBeNull();
  });

  it('keeps difficulty inside the 1..5 the contract promises', () => {
    expect(toCodeTask(row({ difficulty: 9 }))?.difficulty).toBe(5);
    expect(toCodeTask(row({ difficulty: 0 }))?.difficulty).toBe(1);
  });

  it('survives a row with no hints and no checks', () => {
    const task = toCodeTask(row({ hints: [], checks: [] }));
    expect(task?.hints).toEqual([]);
    expect(task?.checks).toEqual([]);
  });
});
