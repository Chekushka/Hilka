import { describe, expect, it } from 'vitest';
import { resolveTaskParams } from './params';
import type { CodeTask, FillTask, FixTask } from './types';

function task(overrides: Partial<CodeTask> = {}): CodeTask {
  return {
    id: 't1',
    slug: 'g7-square',
    topicId: 'topic-1',
    type: 'code',
    title: 'Квадрат',
    payload: { type: 'code', surface: 'turtle', prompt: 'Намалюй квадрат зі стороною {side}.', starter: 'import turtle\n\n' },
    checks: [{ kind: 'shape_props', closed: true, segmentCount: 4 }],
    hints: [],
    reference: { code: 'import turtle\nfor i in range(4):\n    turtle.forward({side})\n    turtle.right(90)' },
    difficulty: 2,
    gradeTags: [7],
    version: 1,
    status: 'published',
    ...overrides
  };
}

describe('resolveTaskParams', () => {
  it('leaves a task with no params entirely unchanged', () => {
    const plain = task();
    expect(resolveTaskParams(plain, 42)).toBe(plain);
  });

  it('strips params from a parameterized task even though nothing is substituted without a spec', () => {
    // params: {} is a degenerate but valid spec — no placeholders to resolve, but the field itself must not leak.
    const result = resolveTaskParams(task({ params: {} }), 1);
    expect(result.params).toBeUndefined();
  });

  it('substitutes the same placeholder in prompt and reference.code identically', () => {
    const withParams = task({ params: { side: { choice: ['60', '80', '100'] } } });
    const resolved = resolveTaskParams(withParams, 7);
    const side = resolved.payload.prompt.match(/зі стороною (\d+)/)?.[1];
    expect(side).toBeDefined();
    expect(resolved.reference.code).toContain(`turtle.forward(${side})`);
    expect(resolved.params).toBeUndefined();
  });

  it('is deterministic — the same seed always resolves the same variant', () => {
    const withParams = task({ params: { side: { choice: ['60', '80', '100', '120'] } } });
    const first = resolveTaskParams(withParams, 999);
    const second = resolveTaskParams(withParams, 999);
    expect(first.payload.prompt).toBe(second.payload.prompt);
    expect(first.reference.code).toBe(second.reference.code);
  });

  it('substitutes an int param in cases[].stdin too', () => {
    const withCases = task({
      payload: { type: 'code', surface: 'console', prompt: 'Скільки буде {a} + 1?', starter: '' },
      cases: [{ stdin: ['{a}'] }],
      reference: { code: 'n = int(input())\nprint(n + 1)' },
      params: { a: { int: [5, 5] } }
    });
    const resolved = resolveTaskParams(withCases, 3);
    expect(resolved.cases?.[0].stdin).toEqual(['5']);
    expect(resolved.payload.prompt).toBe('Скільки буде 5 + 1?');
  });

  it('leaves an unmatched placeholder untouched rather than erroring', () => {
    const withParams = task({ params: { side: { choice: ['80'] } } });
    const withTypo = { ...withParams, payload: { ...withParams.payload, prompt: 'Сторона: {sside}' } };
    const resolved = resolveTaskParams(withTypo, 1);
    expect(resolved.payload.prompt).toBe('Сторона: {sside}');
  });
});

describe('resolveTaskParams — grid worlds', () => {
  const gridTask = task({
    payload: {
      type: 'code',
      surface: 'grid',
      prompt: 'Доведи робота.',
      starter: 'import robot\n',
      grid: { start: { x: 1, y: 6, dir: 'N' }, goal: { x: '{gx}', y: '{gy}' }, rocks: [] }
    },
    params: { gx: { int: [3, 6] }, gy: { int: [1, 3] } },
    reference: { code: 'import robot\nrobot.forward(6 - {gy})\nrobot.right()\nrobot.forward({gx} - 1)\n' }
  });

  it('places the goal from the same values as the reference code', () => {
    const resolved = resolveTaskParams(gridTask, 42);
    const goal = resolved.payload.grid!.goal as { x: number; y: number };
    expect(goal.x).toBeGreaterThanOrEqual(3);
    expect(goal.x).toBeLessThanOrEqual(6);
    expect(resolved.reference.code).toContain(`robot.forward(6 - ${goal.y})`);
    expect(resolved.reference.code).toContain(`robot.forward(${goal.x} - 1)`);
  });

  it('is deterministic — the same seed always places the same world', () => {
    expect(resolveTaskParams(gridTask, 7).payload.grid).toEqual(resolveTaskParams(gridTask, 7).payload.grid);
  });

  it('refuses a variant whose world is invalid rather than hand it to a student', () => {
    const onStart = task({
      ...gridTask,
      payload: { ...gridTask.payload, grid: { start: { x: 1, y: 6, dir: 'N' }, goal: { x: '{gx}', y: 6 }, rocks: [] } } as CodeTask['payload'],
      params: { gx: { int: [1, 1] } }
    });
    expect(() => resolveTaskParams(onStart, 1)).toThrow(/invalid grid world/);
  });
});

describe('resolveTaskParams for fix and fill', () => {
  const fix: FixTask = {
    id: 'f1',
    slug: 'g8-fix-variant',
    topicId: 'topic-1',
    type: 'fix',
    title: 'Виправ',
    payload: { type: 'fix', surface: 'console', prompt: 'Помножиш на {k}.', broken: 'n = int(input())\nprint(n + {k})' },
    checks: [{ kind: 'matches_reference', compare: 'numbers' }],
    cases: [{ stdin: ['{start}'] }],
    hints: [],
    reference: { code: 'n = int(input())\nprint(n * {k})' },
    difficulty: 2,
    gradeTags: [8],
    version: 1,
    status: 'published',
    params: { k: { int: [2, 9] }, start: { choice: ['3', '5'] } }
  };
  const fill: FillTask = {
    id: 'g1',
    slug: 'g7-fill-variant',
    topicId: 'topic-1',
    type: 'fill',
    title: 'Заповни',
    payload: { type: 'fill', prompt: 'Квадрат зі стороною {side}.', template: 'for i in range({{0}}):\n    turtle.forward({side})' },
    checks: [{ kind: 'shape_equals' }],
    hints: [],
    reference: { code: 'for i in range(4):\n    turtle.forward({side})' },
    difficulty: 2,
    gradeTags: [7],
    version: 1,
    status: 'published',
    params: { side: { choice: ['60', '80'] } }
  };

  it('substitutes the broken program, the prompt, the cases and the reference of a fix task', () => {
    const resolved = resolveTaskParams(fix, 7);
    expect(resolved.params).toBeUndefined();
    expect(resolved.payload.broken).toMatch(/^n = int\(input\(\)\)\nprint\(n \+ [2-9]\)$/);
    const k = resolved.payload.broken.match(/\+ (\d)/)![1];
    expect(resolved.reference.code).toBe(`n = int(input())\nprint(n * ${k})`);
    expect(resolved.payload.prompt).toBe(`Помножиш на ${k}.`);
    expect(['3', '5']).toContain(resolved.cases![0].stdin[0]);
  });

  it('substitutes the template without touching its gaps, and the reference, of a fill task', () => {
    const resolved = resolveTaskParams(fill, 3);
    const side = resolved.reference.code.match(/forward\((\d+)\)/)![1];
    expect(['60', '80']).toContain(side);
    expect(resolved.payload.template).toBe(`for i in range({{0}}):\n    turtle.forward(${side})`);
  });

  it('gives the same student the same variant every time', () => {
    expect(resolveTaskParams(fix, 1234)).toEqual(resolveTaskParams(fix, 1234));
    expect(resolveTaskParams(fill, 99)).toEqual(resolveTaskParams(fill, 99));
  });
});
