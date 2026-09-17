import { describe, expect, it } from 'vitest';
import { evaluateChecks } from '../checker';
import { parsonsCanonicalSubmission, parsonsPool } from './parsons';
import type { ParsonsPayload } from './types';

const payload: ParsonsPayload = {
  type: 'parsons',
  prompt: 'Склади трикутник.',
  lines: [
    { text: 'import turtle', indent: 0 },
    { text: 'for i in range(3):', indent: 0 },
    { text: 'turtle.forward(100)', indent: 1 },
    { text: 'turtle.right(120)', indent: 1 }
  ],
  distractors: ['turtle.right(90)'],
  indentMode: 'given'
};

describe('parsonsPool', () => {
  it('gives real lines the payload order as their index', () => {
    const pool = parsonsPool(payload);
    expect(pool.slice(0, 4).map((item) => item.poolIndex)).toEqual([0, 1, 2, 3]);
    expect(pool.slice(0, 4).every((item) => !item.isDistractor)).toBe(true);
  });

  it('extends the same index space for distractors, never colliding with a real line', () => {
    const pool = parsonsPool(payload);
    const distractor = pool[pool.length - 1];
    expect(distractor.isDistractor).toBe(true);
    expect(distractor.poolIndex).toBe(payload.lines.length);
  });

  it('has no pool at all with no distractors', () => {
    const pool = parsonsPool({ ...payload, distractors: undefined });
    expect(pool.every((item) => !item.isDistractor)).toBe(true);
  });
});

describe('parsonsCanonicalSubmission', () => {
  it('is the identity order over payload.lines, with each line kept at its given indent', () => {
    const submission = parsonsCanonicalSubmission(payload);
    expect(submission.orderedLines).toEqual([
      { index: 0, indent: 0 },
      { index: 1, indent: 0 },
      { index: 2, indent: 1 },
      { index: 3, indent: 1 }
    ]);
  });

  it('always passes order_equals over the same payload — the publish gate this backs', () => {
    const submission = parsonsCanonicalSubmission(payload);
    const report = evaluateChecks([{ kind: 'order_equals', lines: [0, 1, 2, 3] }], { submission });
    expect(report.passed).toBe(true);
  });

  it('fails a check that omits or reorders a line — the gate must be able to say no', () => {
    const submission = parsonsCanonicalSubmission(payload);
    const report = evaluateChecks([{ kind: 'order_equals', lines: [1, 0, 2, 3] }], { submission });
    expect(report.passed).toBe(false);
  });
});
