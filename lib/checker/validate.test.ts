import { describe, expect, it } from 'vitest';
import { validateTaskChecks } from './validate';

describe('validateTaskChecks', () => {
  it('rejects stdout_equals on a task with cases', () => {
    // The rule exists because prompt wording varies between correct solutions,
    // and exact matching fails students who are right.
    const errors = validateTaskChecks({
      checks: [{ kind: 'stdout_equals', value: '22.86' }],
      cases: [{ checks: [] }],
      reference: { code: 'print(1)' }
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('stdout_equals');
  });

  it('rejects it inside a case too, not just at task level', () => {
    const errors = validateTaskChecks({
      checks: [],
      cases: [{ checks: [{ kind: 'stdout_equals', value: 'x' }] }]
    });
    expect(errors).toHaveLength(1);
  });

  it('allows stdout_equals when the task has no input', () => {
    const errors = validateTaskChecks({
      checks: [{ kind: 'stdout_equals', value: 'Привіт' }],
      reference: { code: 'print("Привіт")' }
    });
    expect(errors).toEqual([]);
  });

  it('requires a reference solution for computed expectations', () => {
    const errors = validateTaskChecks({ checks: [{ kind: 'shape_equals' }] });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain('reference');
  });

  it('rejects an empty uses check', () => {
    const errors = validateTaskChecks({ checks: [{ kind: 'uses' }] });
    expect(errors.some((e) => e.message.includes('uses'))).toBe(true);
  });

  it('accepts a well-formed input-driven task', () => {
    const errors = validateTaskChecks({
      checks: [],
      cases: [
        { checks: [{ kind: 'number_close', value: 22.86, tol: 0.05, which: 'last' }] },
        { checks: [{ kind: 'number_close', value: 19.53, tol: 0.05, which: 'last' }] }
      ],
      reference: { code: 'w = float(input())' }
    });
    expect(errors).toEqual([]);
  });
});
