import { describe, expect, it } from 'vitest';
import { toCodeTask, toFixTask, toParsonsTask, toPredictTask, toQuizTask, toTask, type TaskRow } from './task-mapping';

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

function parsonsRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return row({
    type: 'parsons',
    payload: {
      type: 'parsons',
      prompt: 'Склади трикутник.',
      lines: [
        { text: 'import turtle', indent: 0 },
        { text: 'for i in range(3):', indent: 0 }
      ],
      distractors: ['turtle.right(90)'],
      indentMode: 'given'
    },
    checks: [{ kind: 'order_equals', lines: [0, 1] }],
    reference: null,
    ...overrides
  });
}

describe('toParsonsTask', () => {
  it('maps a published row, with no reference required', () => {
    const task = toParsonsTask(parsonsRow());
    expect(task).not.toBeNull();
    expect(task?.type).toBe('parsons');
    expect(task?.payload.lines).toHaveLength(2);
    expect(task).not.toHaveProperty('reference');
  });

  it('rejects a row whose type is not parsons', () => {
    expect(toParsonsTask(row())).toBeNull();
  });

  it('rejects a row whose payload disagrees with its type', () => {
    const broken = parsonsRow();
    broken.payload = { type: 'code' } as unknown as TaskRow['payload'];
    expect(toParsonsTask(broken)).toBeNull();
  });
});

function quizRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return row({
    type: 'quiz',
    payload: {
      type: 'quiz',
      prompt: 'Яке ім’я змінної правильне?',
      options: ['1x', 'x1'],
      multiple: false
    },
    checks: [{ kind: 'choice_equals', indices: [1] }],
    reference: null,
    ...overrides
  });
}

describe('toQuizTask', () => {
  it('maps a published row, with no reference required', () => {
    const task = toQuizTask(quizRow());
    expect(task).not.toBeNull();
    expect(task?.type).toBe('quiz');
    expect(task?.payload.options).toHaveLength(2);
    expect(task).not.toHaveProperty('reference');
  });

  it('rejects a row whose type is not quiz', () => {
    expect(toQuizTask(row())).toBeNull();
  });

  it('rejects a row whose payload disagrees with its type', () => {
    const broken = quizRow();
    broken.payload = { type: 'code' } as unknown as TaskRow['payload'];
    expect(toQuizTask(broken)).toBeNull();
  });
});

function predictRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return row({
    type: 'predict',
    payload: {
      type: 'predict',
      prompt: 'Що виведе ця програма?',
      code: 'print(2 + 3 * 4)',
      answerMode: 'text'
    },
    checks: [{ kind: 'text_equals', value: '14', normalize: 'trim' }],
    reference: { code: 'print(2 + 3 * 4)' },
    ...overrides
  });
}

describe('toPredictTask', () => {
  it('maps a published row to the task the workspace consumes', () => {
    const task = toPredictTask(predictRow());
    expect(task).not.toBeNull();
    expect(task?.type).toBe('predict');
    expect(task?.payload.code).toBe('print(2 + 3 * 4)');
    expect(task?.reference.code).toBe('print(2 + 3 * 4)');
  });

  it('rejects a row whose type is not predict', () => {
    expect(toPredictTask(row())).toBeNull();
  });

  it('rejects a row whose payload disagrees with its type', () => {
    const broken = predictRow();
    broken.payload = { type: 'code' } as unknown as TaskRow['payload'];
    expect(toPredictTask(broken)).toBeNull();
  });

  it('rejects a predict task with no reference solution', () => {
    // Same rule as code (CLAUDE.md rule 5): payload.code IS the reference,
    // and without one there is nothing to have verified the checks against.
    expect(toPredictTask(predictRow({ reference: null }))).toBeNull();
    expect(toPredictTask(predictRow({ reference: { code: '' } }))).toBeNull();
  });
});

function fixRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return row({
    type: 'fix',
    payload: {
      type: 'fix',
      surface: 'turtle',
      prompt: 'Виправ квадрат.',
      broken: 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(80)'
    },
    checks: [{ kind: 'shape_props', closed: true, segmentCount: 4 }],
    reference: { code: 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)' },
    ...overrides
  });
}

describe('toFixTask', () => {
  it('maps a published row to the task the workspace consumes', () => {
    const task = toFixTask(fixRow());
    expect(task).not.toBeNull();
    expect(task?.type).toBe('fix');
    expect(task?.payload.broken).toContain('right(80)');
    expect(task?.reference.code).toContain('right(90)');
  });

  it('rejects a row whose type is not fix', () => {
    expect(toFixTask(row())).toBeNull();
  });

  it('rejects a row whose payload disagrees with its type', () => {
    const broken = fixRow();
    broken.payload = { type: 'code' } as unknown as TaskRow['payload'];
    expect(toFixTask(broken)).toBeNull();
  });

  it('rejects a fix task with no reference solution', () => {
    // Same rule as code (CLAUDE.md rule 5): the correct fix is a separately
    // authored reference, never payload.broken itself.
    expect(toFixTask(fixRow({ reference: null }))).toBeNull();
    expect(toFixTask(fixRow({ reference: { code: '' } }))).toBeNull();
  });
});

describe('toTask', () => {
  it('dispatches a code row to toCodeTask', () => {
    expect(toTask(row())?.type).toBe('code');
  });

  it('dispatches a parsons row to toParsonsTask', () => {
    expect(toTask(parsonsRow())?.type).toBe('parsons');
  });

  it('dispatches a quiz row to toQuizTask', () => {
    expect(toTask(quizRow())?.type).toBe('quiz');
  });

  it('dispatches a predict row to toPredictTask', () => {
    expect(toTask(predictRow())?.type).toBe('predict');
  });

  it('dispatches a fix row to toFixTask', () => {
    expect(toTask(fixRow())?.type).toBe('fix');
  });

  it('returns null for a type nothing maps yet', () => {
    expect(toTask(row({ type: 'fill', payload: { type: 'fill' } as unknown as TaskRow['payload'] }))).toBeNull();
  });
});
