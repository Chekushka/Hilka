import { describe, expect, it } from 'vitest';
import { fillTemplateGaps, isFillTemplateValid, parseFillTemplate, substituteFillTemplate } from './fill';

const TEMPLATE = 'import turtle\nfor i in range({{1}}):\n    turtle.forward({{2}})\n    turtle.right({{3}})\n';

describe('parseFillTemplate', () => {
  it('splits text and gaps in source order', () => {
    expect(parseFillTemplate('a{{1}}b{{2}}c')).toEqual([
      { kind: 'text', value: 'a' },
      { kind: 'gap', index: 1 },
      { kind: 'text', value: 'b' },
      { kind: 'gap', index: 2 },
      { kind: 'text', value: 'c' }
    ]);
  });

  it('handles a template with no gaps at all', () => {
    expect(parseFillTemplate('print(1)')).toEqual([{ kind: 'text', value: 'print(1)' }]);
  });

  it('handles a template that starts or ends with a gap', () => {
    expect(parseFillTemplate('{{1}}x{{2}}')).toEqual([
      { kind: 'gap', index: 1 },
      { kind: 'text', value: 'x' },
      { kind: 'gap', index: 2 }
    ]);
  });
});

describe('fillTemplateGaps', () => {
  it('lists every distinct gap index once, in first-appearance order', () => {
    expect(fillTemplateGaps(TEMPLATE)).toEqual([1, 2, 3]);
  });

  it('deduplicates a gap index reused more than once', () => {
    expect(fillTemplateGaps('{{1}} and {{1}} again')).toEqual([1]);
  });

  it('is empty for a template with no gaps', () => {
    expect(fillTemplateGaps('print(1)')).toEqual([]);
  });
});

describe('substituteFillTemplate', () => {
  it('replaces every gap with the matching value', () => {
    expect(substituteFillTemplate(TEMPLATE, { 1: '5', 2: '80', 3: '72' })).toBe(
      'import turtle\nfor i in range(5):\n    turtle.forward(80)\n    turtle.right(72)\n'
    );
  });

  it('substitutes an empty string for a gap the student has not answered yet', () => {
    expect(substituteFillTemplate('range({{1}})', {})).toBe('range()');
  });
});

describe('isFillTemplateValid', () => {
  it('accepts a template with at least one gap', () => {
    expect(isFillTemplateValid(TEMPLATE)).toBe(true);
  });

  it('rejects a template with no gaps — that is just a code task', () => {
    expect(isFillTemplateValid('print(1)')).toBe(false);
  });
});
