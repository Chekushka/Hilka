import { describe, expect, it } from 'vitest';
import { evaluateChecks, validateTaskChecks, type Check } from '@/lib/checker';
import {
  applyField,
  applyMessage,
  blockedKind,
  changeKind,
  CHECK_FIELDS,
  CHECK_KINDS,
  checkKindsFor,
  defaultCheck,
  fieldText,
  moveItem,
  normalizeCase,
  stdinFromText,
  unsupportedKeys,
  type FieldSpec
} from './check-form';

function field(kind: keyof typeof CHECK_FIELDS, key: string): FieldSpec {
  const spec = CHECK_FIELDS[kind].find((candidate) => candidate.key === key);
  if (!spec) throw new Error(`no field ${key} on ${kind}`);
  return spec;
}

function apply(check: Check, kind: keyof typeof CHECK_FIELDS, key: string, text: string): Check {
  const result = applyField(check, field(kind, key), text);
  if (!result.ok) throw new Error(`"${text}" did not parse for ${kind}.${key}`);
  return result.check;
}

describe('defaultCheck', () => {
  it('starts every kind as a check the builder can show entirely', () => {
    for (const kind of CHECK_KINDS) {
      if (kind === 'shape_contains') continue; // segments are JSON-only by design
      expect(unsupportedKeys(defaultCheck(kind))).toEqual([]);
    }
  });

  it('starts every kind as a check the validator accepts, apart from an empty uses', () => {
    for (const kind of CHECK_KINDS) {
      const errors = validateTaskChecks({ checks: [defaultCheck(kind)] }, { requireReference: false });
      if (kind === 'uses') expect(errors).toHaveLength(1);
      else expect(errors).toEqual([]);
    }
  });

  it('starts a turtle shape check with translate, as TASK_SCHEMA recommends', () => {
    expect(defaultCheck('shape_equals')).toEqual({ kind: 'shape_equals', normalize: ['translate'] });
  });
});

describe('checkKindsFor', () => {
  it('offers only the kinds a task type can be judged by', () => {
    expect(checkKindsFor('quiz')).toEqual(['choice_equals']);
    expect(checkKindsFor('parsons')).toEqual(['order_equals']);
    expect(checkKindsFor('predict')).toEqual(['text_equals', 'choice_equals']);
    expect(checkKindsFor('code')).toContain('shape_equals');
    expect(checkKindsFor('code')).not.toContain('choice_equals');
  });
});

describe('blockedKind', () => {
  it('blocks stdout_equals on a task with cases, and nothing else', () => {
    expect(blockedKind('stdout_equals', { hasCases: true })).toBe('stdoutWithCases');
    expect(blockedKind('stdout_equals', { hasCases: false })).toBeNull();
    expect(blockedKind('number_close', { hasCases: true })).toBeNull();
  });
});

describe('changeKind', () => {
  it('resets the fields but keeps the message', () => {
    const check: Check = { kind: 'number_close', value: 5, tol: 0.1, message: 'Перевір формулу' };
    expect(changeKind(check, 'last_line_equals')).toEqual({ kind: 'last_line_equals', value: '', message: 'Перевір формулу' });
  });
});

describe('unsupportedKeys', () => {
  it('names the fields the builder has no control for', () => {
    expect(unsupportedKeys({ kind: 'shape_props', closed: true, bbox: [0, 0, 10, 10] })).toEqual(['bbox']);
    expect(unsupportedKeys({ kind: 'shape_contains', segments: [] })).toEqual(['segments']);
  });

  it('is empty for a check made only of builder fields', () => {
    expect(unsupportedKeys({ kind: 'uses', all: ['for'], message: 'Потрібен цикл' })).toEqual([]);
  });
});

describe('applyField / fieldText', () => {
  it('round-trips a number list', () => {
    const check = apply(defaultCheck('choice_equals'), 'choice_equals', 'indices', '0, 2');
    expect(check).toEqual({ kind: 'choice_equals', indices: [0, 2] });
    expect(fieldText(check, field('choice_equals', 'indices'))).toBe('0, 2');
  });

  it('accepts a decimal comma, the way a Ukrainian teacher types it', () => {
    expect(apply(defaultCheck('number_close'), 'number_close', 'value', '3,5')).toMatchObject({ value: 3.5 });
  });

  it('does not commit a number that does not parse yet', () => {
    expect(applyField(defaultCheck('number_close'), field('number_close', 'tol'), 'abc')).toEqual({ ok: false });
    expect(applyField(defaultCheck('number_close'), field('number_close', 'tol'), '')).toEqual({ ok: false });
  });

  it('drops an optional number left empty', () => {
    const check = apply({ kind: 'shape_equals', tolerance: 2 }, 'shape_equals', 'tolerance', '');
    expect(check).toEqual({ kind: 'shape_equals' });
  });

  it('writes a string list and omits an optional empty one', () => {
    const check = apply(defaultCheck('uses'), 'uses', 'all', 'for, while');
    expect(check).toEqual({ kind: 'uses', all: ['for', 'while'] });
    expect(apply(check, 'uses', 'any', ' ')).toEqual({ kind: 'uses', all: ['for', 'while'] });
  });

  it('keeps a required list as an empty array', () => {
    expect(apply({ kind: 'forbids', names: ['min'] }, 'forbids', 'names', '')).toEqual({ kind: 'forbids', names: [] });
  });

  it('writes a boolean only when on', () => {
    const on = apply(defaultCheck('stdout_contains'), 'stdout_contains', 'ignoreCase', 'true');
    expect(on).toEqual({ kind: 'stdout_contains', value: '', ignoreCase: true });
    expect(apply(on, 'stdout_contains', 'ignoreCase', 'false')).toEqual({ kind: 'stdout_contains', value: '' });
  });

  it('keeps a three-way boolean distinct from "either"', () => {
    const open = apply(defaultCheck('shape_props'), 'shape_props', 'closed', 'false');
    expect(open).toEqual({ kind: 'shape_props', closed: false });
    expect(apply(open, 'shape_props', 'closed', '')).toEqual({ kind: 'shape_props' });
  });

  it('reads which as last, first or a line index', () => {
    const base = defaultCheck('number_close');
    expect(apply(base, 'number_close', 'which', 'first')).toMatchObject({ which: 'first' });
    expect(apply(base, 'number_close', 'which', '2')).toMatchObject({ which: 2 });
    expect(applyField(base, field('number_close', 'which'), '1.5')).toEqual({ ok: false });
  });

  it('reads a range, keeping a single segment count a number and widening a length to a pair', () => {
    const base = defaultCheck('shape_props');
    expect(apply(base, 'shape_props', 'segmentCount', '4')).toMatchObject({ segmentCount: 4 });
    expect(apply(base, 'shape_props', 'segmentCount', '4–6')).toMatchObject({ segmentCount: [4, 6] });
    expect(apply(base, 'shape_props', 'totalLength', '400')).toMatchObject({ totalLength: [400, 400] });
    expect(applyField(base, field('shape_props', 'segmentCount'), '6-4')).toEqual({ ok: false });
    expect(fieldText({ kind: 'shape_props', segmentCount: [4, 6] }, field('shape_props', 'segmentCount'))).toBe('4–6');
  });

  it('parses a variable value as JSON, falling back to a plain string', () => {
    const base = defaultCheck('var_equals');
    expect(apply(base, 'var_equals', 'value', '12')).toMatchObject({ value: 12 });
    expect(apply(base, 'var_equals', 'value', '[1, 2]')).toMatchObject({ value: [1, 2] });
    expect(apply(base, 'var_equals', 'value', 'Київ')).toMatchObject({ value: 'Київ' });
    expect(fieldText({ kind: 'var_equals', name: 'x', value: [1, 2] }, field('var_equals', 'value'))).toBe('[1,2]');
  });

  it('keeps only known normalizations', () => {
    const check = apply(defaultCheck('shape_equals'), 'shape_equals', 'normalize', 'translate,rotate,zoom');
    expect(check).toEqual({ kind: 'shape_equals', normalize: ['translate', 'rotate'] });
    expect(apply(check, 'shape_equals', 'normalize', '')).toEqual({ kind: 'shape_equals' });
  });

  it('only accepts a listed select option', () => {
    expect(apply(defaultCheck('text_equals'), 'text_equals', 'normalize', 'loose')).toMatchObject({ normalize: 'loose' });
    expect(applyField(defaultCheck('text_equals'), field('text_equals', 'normalize'), 'fuzzy')).toEqual({ ok: false });
  });

  it('builds a check the evaluator actually judges', () => {
    let check = defaultCheck('number_close');
    check = apply(check, 'number_close', 'value', '16');
    check = apply(check, 'number_close', 'tol', '0,01');
    const evidence = (stdout: string) => ({
      submission: {},
      run: { stdout, drawing: [], error: null, timedOut: false }
    });
    expect(evaluateChecks([check], evidence('Периметр: 16\n')).passed).toBe(true);
    expect(evaluateChecks([check], evidence('Периметр: 15\n')).passed).toBe(false);
  });
});

describe('applyMessage', () => {
  it('drops an empty message so the generic line takes over', () => {
    expect(applyMessage({ kind: 'expr', python: 'x', message: 'a' }, '  ')).toEqual({ kind: 'expr', python: 'x' });
  });
});

describe('moveItem', () => {
  it('moves within bounds and ignores a move past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 1, 2)).toEqual(['a', 'b']);
  });
});

describe('stdinFromText', () => {
  it('is one input per line, ignoring the trailing newline', () => {
    expect(stdinFromText('5\n3\n')).toEqual(['5', '3']);
    expect(stdinFromText('')).toEqual([]);
    expect(stdinFromText('a\n\nb')).toEqual(['a', '', 'b']);
  });
});

describe('normalizeCase', () => {
  it('drops empty optional fields', () => {
    expect(normalizeCase({ stdin: ['1'], label: ' ', hidden: false, checks: [] })).toEqual({ stdin: ['1'] });
    expect(normalizeCase({ stdin: [], label: 'Нуль', hidden: true })).toEqual({ stdin: [], label: 'Нуль', hidden: true });
  });
});
