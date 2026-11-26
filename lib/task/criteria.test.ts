import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import uk from '@/messages/uk.json';
import type { Check } from '@/lib/checker';
import { taskCriteria, type Criterion } from './criteria';
import type { RunCase, Task } from './types';

function codeTask(checks: Check[], cases?: RunCase[], extra: { delivery?: 'file' } = {}): Task {
  return {
    id: 't1',
    slug: 'test-code',
    topicId: 'topic',
    type: 'code',
    title: 'Test',
    payload: { type: 'code', surface: 'console', prompt: 'p', starter: '', ...extra },
    checks,
    ...(cases ? { cases } : {}),
    hints: [],
    reference: { code: 'print(1)' },
    difficulty: 3,
    gradeTags: [7],
    version: 1,
    status: 'published'
  } as Task;
}

const keys = (criteria: Criterion[]) => criteria.map((criterion) => criterion.key);

describe('taskCriteria', () => {
  it('describes a quiz by how many options to pick', () => {
    const quiz = (multiple: boolean) =>
      ({
        ...codeTask([]),
        type: 'quiz',
        payload: { type: 'quiz', prompt: 'p', options: ['a', 'b'], multiple },
        checks: [{ kind: 'choice_equals', indices: [1] }]
      }) as Task;
    expect(keys(taskCriteria(quiz(false)))).toEqual(['choiceOne']);
    expect(keys(taskCriteria(quiz(true)))).toEqual(['choiceAll']);
  });

  it('never puts an expected value into the words', () => {
    const task = codeTask([
      { kind: 'stdout_equals', value: 'SECRET-OUTPUT' },
      { kind: 'var_equals', name: 'total', value: 424242 },
      { kind: 'number_close', value: 31.4159, tol: 0.01 }
    ]);
    const text = JSON.stringify(taskCriteria(task));
    expect(text).not.toContain('SECRET-OUTPUT');
    expect(text).not.toContain('424242');
    expect(text).not.toContain('31.4159');
    // The variable's name is part of the requirement, its value is not.
    expect(taskCriteria(task)).toContainEqual({ key: 'variable', values: { name: 'total' } });
  });

  it('counts cases, names the visible ones and only counts the hidden ones', () => {
    const task = codeTask(
      [],
      [
        { label: 'звичайний', stdin: ['5'], checks: [{ kind: 'number_close', value: 5, tol: 0 }] },
        { label: 'нуль', stdin: ['0'], checks: [{ kind: 'number_close', value: 0, tol: 0 }] },
        { label: 'таємний', stdin: ['-7'], hidden: true, checks: [{ kind: 'number_close', value: -7, tol: 0 }] }
      ]
    );
    const criteria = taskCriteria(task);
    expect(criteria).toEqual([
      { key: 'cases', values: { n: 3 } },
      { key: 'caseLabels', values: { labels: 'звичайний, нуль' } },
      { key: 'hiddenCases', values: { n: 1 } },
      { key: 'outputNumber' }
    ]);
    expect(JSON.stringify(criteria)).not.toContain('таємний');
  });

  it('says nothing about cases when there is only one run', () => {
    const task = codeTask([], [{ stdin: ['5'], checks: [{ kind: 'last_line_equals', value: '5' }] }]);
    expect(keys(taskCriteria(task))).toEqual(['outputLastLine']);
  });

  it('tells a turtle task that commands do not matter, only lines', () => {
    // Authored with the property first; the picture is still named first.
    const task = codeTask([{ kind: 'shape_props', closed: true }, { kind: 'shape_equals', normalize: ['rotate', 'translate'] }]);
    expect(keys(taskCriteria(task))).toEqual([
      'shapeMatch',
      'shapeAnyCommands',
      'shapeAnyPlace',
      'shapeAnyHeading',
      'shapeClosed'
    ]);
  });

  it('names required and forbidden constructs', () => {
    const task = codeTask([
      { kind: 'uses', all: ['for', 'range'] },
      { kind: 'uses', any: ['while'] },
      { kind: 'forbids', names: ['sum'] }
    ]);
    expect(taskCriteria(task)).toEqual([
      { key: 'usesAll', values: { names: 'for, range' } },
      { key: 'usesAll', values: { names: 'while' } },
      { key: 'forbids', values: { names: 'sum' } }
    ]);
  });

  it('notes the latest file for a file-delivery task', () => {
    const task = codeTask([{ kind: 'last_line_equals', value: 'x' }], undefined, { delivery: 'file' });
    expect(keys(taskCriteria(task))).toContain('fileLatest');
  });

  it('describes a check repeated in every case once', () => {
    const task = codeTask(
      [{ kind: 'uses', all: ['if'] }],
      [
        { stdin: ['1'], checks: [{ kind: 'last_line_equals', value: 'a' }] },
        { stdin: ['2'], checks: [{ kind: 'last_line_equals', value: 'b' }] }
      ]
    );
    expect(keys(taskCriteria(task))).toEqual(['cases', 'outputLastLine', 'usesAll']);
  });
});

/** Every published task: something to show, and every line it shows has its Ukrainian text. */
describe('taskCriteria over content/seed-tasks', () => {
  const dir = path.join(process.cwd(), 'content', 'seed-tasks');
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  const items = (uk as unknown as { criteria: { items: Record<string, string> } }).criteria.items;

  it('finds the content', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    it(`${file} has criteria with messages`, () => {
      const task = { difficulty: 1, ...JSON.parse(readFileSync(path.join(dir, file), 'utf8')) } as Task;
      const criteria = taskCriteria(task);
      expect(criteria.length).toBeGreaterThan(0);
      for (const criterion of criteria) {
        const message = items[criterion.key];
        expect(message, criterion.key).toBeTypeOf('string');
        for (const placeholder of message.match(/\{(\w+)\}/g) ?? []) {
          expect(criterion.values ?? {}, `${criterion.key} ${placeholder}`).toHaveProperty(placeholder.slice(1, -1));
        }
      }
    });
  }
});
