import { describe, expect, it } from 'vitest';
import type { Segment } from '@/lib/runner';
import { evaluateChecks } from './evaluate';
import type { Check, Evidence } from './types';

function seg(x1: number, y1: number, x2: number, y2: number, color = 'black'): Segment {
  return { x1, y1, x2, y2, color, width: 1, line: null };
}

const SQUARE = [seg(0, 0, 100, 0), seg(100, 0, 100, -100), seg(100, -100, 0, -100), seg(0, -100, 0, 0)];

function evidence(partial: Partial<Evidence> = {}): Evidence {
  return { submission: {}, run: null, reference: null, ...partial };
}

function ran(stdout: string, drawing: Segment[] = []): Evidence['run'] {
  return { stdout, drawing, error: null, timedOut: false };
}

describe('checks that need no execution', () => {
  it('accepts the right choice in any order', () => {
    const checks: Check[] = [{ kind: 'choice_equals', indices: [0, 2] }];
    expect(evaluateChecks(checks, evidence({ submission: { choiceIndices: [2, 0] } })).passed).toBe(true);
    expect(evaluateChecks(checks, evidence({ submission: { choiceIndices: [0] } })).passed).toBe(false);
  });

  it('checks parsons line order', () => {
    const checks: Check[] = [{ kind: 'order_equals', lines: [0, 1, 2] }];
    const right = { orderedLines: [0, 1, 2].map((index) => ({ index, indent: 0 })) };
    const wrong = { orderedLines: [1, 0, 2].map((index) => ({ index, indent: 0 })) };
    expect(evaluateChecks(checks, evidence({ submission: right })).passed).toBe(true);
    expect(evaluateChecks(checks, evidence({ submission: wrong })).passed).toBe(false);
  });

  it('compares text with the requested normalization', () => {
    const checks: Check[] = [{ kind: 'text_equals', value: 'привіт', normalize: 'loose' }];
    expect(evaluateChecks(checks, evidence({ submission: { text: ' Привіт ' } })).passed).toBe(true);
  });
});

describe('output checks', () => {
  it('ignores prompt wording by looking only at the number', () => {
    // One student prints «Введіть вагу:», another prints nothing. Both are right.
    const checks: Check[] = [{ kind: 'number_close', value: 22.86, tol: 0.05, which: 'last' }];
    expect(evaluateChecks(checks, evidence({ run: ran('Введіть вагу: Введіть зріст: 22.857') })).passed).toBe(true);
    expect(evaluateChecks(checks, evidence({ run: ran('22.857') })).passed).toBe(true);
  });

  it('fails a number outside the tolerance', () => {
    const checks: Check[] = [{ kind: 'number_close', value: 22.86, tol: 0.05 }];
    expect(evaluateChecks(checks, evidence({ run: ran('24.1') })).passed).toBe(false);
  });

  it('compares every number in order for numbers_equal', () => {
    const checks: Check[] = [{ kind: 'numbers_equal', values: [1, 2, 3], tol: 0 }];
    expect(evaluateChecks(checks, evidence({ run: ran('1 2 3') })).passed).toBe(true);
    expect(evaluateChecks(checks, evidence({ run: ran('1 2 3 4') })).passed).toBe(false);
  });

  it('matches the last line and the contained text', () => {
    const run = ran('крок 1\nкрок 2\nРазом: 21\n');
    expect(evaluateChecks([{ kind: 'last_line_equals', value: 'Разом: 21' }], evidence({ run })).passed).toBe(true);
    expect(evaluateChecks([{ kind: 'stdout_contains', value: 'крок 2' }], evidence({ run })).passed).toBe(true);
  });
});

describe('turtle checks', () => {
  it('compares against the executed reference, not stored coordinates', () => {
    const checks: Check[] = [{ kind: 'shape_equals', normalize: ['translate', 'rotate'] }];
    const passing = evidence({ run: ran('', SQUARE), reference: { drawing: SQUARE } });
    expect(evaluateChecks(checks, passing).passed).toBe(true);
  });

  it('fails when no reference has been computed', () => {
    // Better to fail loudly than to pass a task whose expected result is unknown.
    const checks: Check[] = [{ kind: 'shape_equals' }];
    expect(evaluateChecks(checks, evidence({ run: ran('', SQUARE) })).passed).toBe(false);
  });

  it('checks shape properties', () => {
    const checks: Check[] = [{ kind: 'shape_props', closed: true, segmentCount: 4, totalLength: [390, 410] }];
    expect(evaluateChecks(checks, evidence({ run: ran('', SQUARE) })).passed).toBe(true);
    expect(evaluateChecks(checks, evidence({ run: ran('', SQUARE.slice(0, 3)) })).passed).toBe(false);
  });
});

describe('source constraint checks', () => {
  const code = (source: string): Evidence => evidence({ submission: { code: source } });

  it('passes uses.all when every required name is present', () => {
    const checks: Check[] = [{ kind: 'uses', all: ['for', 'range'] }];
    expect(evaluateChecks(checks, code('for i in range(3):\n    pass')).passed).toBe(true);
    expect(evaluateChecks(checks, code('while True:\n    pass')).passed).toBe(false);
  });

  it('passes uses.any when at least one required name is present', () => {
    const checks: Check[] = [{ kind: 'uses', any: ['for', 'while'] }];
    expect(evaluateChecks(checks, code('while True:\n    pass')).passed).toBe(true);
    expect(evaluateChecks(checks, code('x = 1')).passed).toBe(false);
  });

  it('does not count a name that only appears in a string literal', () => {
    const checks: Check[] = [{ kind: 'uses', all: ['for'] }];
    expect(evaluateChecks(checks, code('print("a for loop")')).passed).toBe(false);
  });

  it('matches a dotted call name', () => {
    const checks: Check[] = [{ kind: 'uses', all: ['turtle.forward'] }];
    expect(evaluateChecks(checks, code('turtle.forward(100)')).passed).toBe(true);
    expect(evaluateChecks(checks, code('turtle.backward(100)')).passed).toBe(false);
  });

  it('rejects code that contains a forbidden name', () => {
    const checks: Check[] = [{ kind: 'forbids', names: ['while'] }];
    expect(evaluateChecks(checks, code('for i in range(3):\n    pass')).passed).toBe(true);
    expect(evaluateChecks(checks, code('while True:\n    pass')).passed).toBe(false);
  });

  it('does not let a forbidden keyword fire on an identifier that merely contains it', () => {
    const checks: Check[] = [{ kind: 'forbids', names: ['while'] }];
    expect(evaluateChecks(checks, code('whileCount = 0')).passed).toBe(true);
  });

  it('fails when no code was submitted', () => {
    expect(evaluateChecks([{ kind: 'forbids', names: ['while'] }], evidence()).passed).toBe(false);
  });
});

describe('report shape', () => {
  it('requires every check to pass', () => {
    const checks: Check[] = [
      { kind: 'stdout_contains', value: 'так' },
      { kind: 'stdout_contains', value: 'ні' }
    ];
    const report = evaluateChecks(checks, evidence({ run: ran('так') }));
    expect(report.passed).toBe(false);
    expect(report.results.map((r) => r.passed)).toEqual([true, false]);
  });

  it("uses the author's message when there is one, and a calm line when there is not", () => {
    const authored: Check = {
      kind: 'shape_props',
      segmentCount: 4,
      message: 'Периметр правильний, але фігура не замкнена.'
    };
    const [withMessage] = evaluateChecks([authored], evidence({ run: ran('', []) })).results;
    expect(withMessage.message).toBe('Периметр правильний, але фігура не замкнена.');

    const [without] = evaluateChecks([{ kind: 'shape_props', segmentCount: 4 }], evidence({ run: ran('', []) })).results;
    expect(without.message).toBe('Фігура має інші властивості, ніж потрібно.');
  });

  it('never passes a kind that has no evaluator yet', () => {
    const report = evaluateChecks([{ kind: 'expr', python: 'x == 1' }], evidence({ run: ran('') }));
    expect(report.passed).toBe(false);
    expect(report.results[0].unsupported).toBe(true);
  });

  it('fails checks that needed a run when nothing was executed', () => {
    expect(evaluateChecks([{ kind: 'stdout_equals', value: 'x' }], evidence()).passed).toBe(false);
  });
});
