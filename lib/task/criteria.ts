/**
 * What a task is judged on, in words a student reads before handing it in
 * (docs/AI_CONTEXT.md, "Grading" — students know what they are graded for).
 * Generated from the task's own checks and cases, which are data, so every
 * published task has criteria without anyone writing them, and they can never
 * drift from what is actually checked.
 *
 * Never the answer: a check that holds the expected value itself
 * (`choice_equals`, `text_equals`, `stdout_equals`, `var_equals`'s value, a
 * hidden case's input) is described by the kind of requirement only.
 *
 * Pure. Returns message keys under `criteria.items` with their values; the
 * component turns them into Ukrainian through messages/uk.json.
 */
import type { Check } from '@/lib/checker';
import type { RunCase, Task } from './types';

/**
 * Every line a task can show, in the order it is shown: how the answer is
 * given, what runs it, what its output and drawing must be, then constraints.
 */
const ORDER = [
  'choiceOne',
  'choiceAll',
  'predictChoice',
  'predictText',
  'predictTextLoose',
  'textAnswer',
  'distractors',
  'orderLines',
  'orderIndent',
  'cases',
  'caseLabels',
  'hiddenCases',
  'outputExact',
  'outputExactStrict',
  'outputContains',
  'outputContainsAnyCase',
  'outputLastLine',
  'outputNumber',
  'variable',
  'condition',
  'shapeMatch',
  'shapeAnyCommands',
  'shapeAnyPlace',
  'shapeAnyHeading',
  'shapeAnySize',
  'shapeContains',
  'shapeClosed',
  'shapeSegments',
  'shapeSegmentsRange',
  'shapeSize',
  'shapeColors',
  'usesAll',
  'usesAny',
  'forbids',
  'gridGoal',
  'fileLatest'
] as const;

export type CriterionKey = (typeof ORDER)[number];

export interface Criterion {
  key: CriterionKey;
  values?: Record<string, string | number>;
}

/** The criteria a task's checks and cases amount to, in a stable order, without repeats. */
export function taskCriteria(task: Task): Criterion[] {
  const out: Criterion[] = [];
  const seen = new Set<string>();
  const add = (criterion: Criterion) => {
    const id = `${criterion.key}:${JSON.stringify(criterion.values ?? {})}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push(criterion);
  };

  if (task.type === 'parsons' && (task.payload.distractors?.length ?? 0) > 0) {
    for (const check of task.checks) if (check.kind === 'order_equals') add({ key: 'distractors' });
  }

  const cases: RunCase[] = 'cases' in task && task.cases ? task.cases : [];
  if (cases.length > 1) {
    add({ key: 'cases', values: { n: cases.length } });
    const labels = cases.filter((c) => !c.hidden && c.label).map((c) => c.label as string);
    if (labels.length > 0) add({ key: 'caseLabels', values: { labels: labels.join(', ') } });
    const hidden = cases.filter((c) => c.hidden).length;
    if (hidden > 0) add({ key: 'hiddenCases', values: { n: hidden } });
  }

  const checks: Check[] = [...task.checks, ...cases.flatMap((c) => c.checks ?? [])];
  for (const check of checks) {
    for (const criterion of describeCheck(check, task)) add(criterion);
  }

  if ((task.type === 'code' || task.type === 'fix') && task.payload.delivery === 'file') {
    add({ key: 'fileLatest' });
  }
  // Stable: lines of one key keep the order of the checks they came from.
  return out.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}

const names = (list: string[]) => list.join(', ');

/**
 * One check's requirement. Exhaustive over `Check['kind']`: a new kind does not
 * compile until it says what it asks of the student (docs/TASK_SCHEMA.md, "Criteria").
 */
function describeCheck(check: Check, task: Task): Criterion[] {
  switch (check.kind) {
    case 'choice_equals':
      if (task.type === 'predict') return [{ key: 'predictChoice' }];
      return [{ key: task.type === 'quiz' && task.payload.multiple ? 'choiceAll' : 'choiceOne' }];
    case 'text_equals':
      if (task.type === 'predict') return [{ key: check.normalize === 'loose' ? 'predictTextLoose' : 'predictText' }];
      return [{ key: 'textAnswer' }];
    case 'order_equals':
      return check.checkIndent ? [{ key: 'orderLines' }, { key: 'orderIndent' }] : [{ key: 'orderLines' }];
    case 'stdout_equals':
      return [{ key: check.trim === false ? 'outputExactStrict' : 'outputExact' }];
    case 'stdout_contains':
      return [{ key: check.ignoreCase ? 'outputContainsAnyCase' : 'outputContains' }];
    case 'last_line_equals':
      return [{ key: 'outputLastLine' }];
    case 'number_close':
    case 'numbers_equal':
      return [{ key: 'outputNumber' }];
    case 'matches_reference':
      return [{ key: check.compare === 'numbers' ? 'outputNumber' : 'outputLastLine' }];
    case 'var_equals':
      return [{ key: 'variable', values: { name: check.name } }];
    case 'expr':
      return [{ key: 'condition' }];
    case 'shape_equals': {
      const normalize = check.normalize ?? [];
      const out: Criterion[] = [{ key: 'shapeMatch' }, { key: 'shapeAnyCommands' }];
      if (normalize.includes('translate')) out.push({ key: 'shapeAnyPlace' });
      if (normalize.includes('rotate')) out.push({ key: 'shapeAnyHeading' });
      if (normalize.includes('scale')) out.push({ key: 'shapeAnySize' });
      return out;
    }
    case 'shape_contains':
      return [{ key: 'shapeContains' }];
    case 'shape_props': {
      const out: Criterion[] = [];
      if (check.closed) out.push({ key: 'shapeClosed' });
      if (typeof check.segmentCount === 'number') {
        out.push({ key: 'shapeSegments', values: { n: check.segmentCount } });
      } else if (check.segmentCount) {
        out.push({ key: 'shapeSegmentsRange', values: { min: check.segmentCount[0], max: check.segmentCount[1] } });
      }
      if (check.totalLength || check.bbox) out.push({ key: 'shapeSize' });
      if (check.colors && check.colors.length > 0) out.push({ key: 'shapeColors', values: { colors: names(check.colors) } });
      return out;
    }
    case 'uses': {
      const out: Criterion[] = [];
      if (check.all && check.all.length > 0) out.push({ key: 'usesAll', values: { names: names(check.all) } });
      if (check.any && check.any.length > 0) {
        out.push(
          check.any.length === 1
            ? { key: 'usesAll', values: { names: check.any[0] } }
            : { key: 'usesAny', values: { names: names(check.any) } }
        );
      }
      return out;
    }
    case 'forbids':
      return check.names.length > 0 ? [{ key: 'forbids', values: { names: names(check.names) } }] : [];
    case 'grid_goal':
      return [{ key: 'gridGoal' }];
  }
}
