import { describe, expect, it } from 'vitest';
import { constructsIn, taughtConstructs, untaughtConstructs } from './constructs';

describe('constructsIn', () => {
  it('names keywords, calls, methods, imports and comprehensions', () => {
    const found = constructsIn(`import math
from random import randint
def area(r):
    return math.pi * r ** 2
values = [area(r) for r in range(3)]
values.append(sum(values))
while True:
    break
print(f"{values[0]:.2f}")
`);
    for (const construct of [
      'import:math',
      'import:random',
      'kw:def',
      'kw:return',
      'comprehension',
      'method:append',
      'call:sum',
      'call:range',
      'call:print',
      'while-true',
      'kw:break',
      'fstring',
      'fstring-format'
    ]) {
      expect(found, construct).toContain(construct);
    }
    // The program's own function is not a borrowed construct; a module's function is not a method.
    expect(found).not.toContain('call:area');
    expect(found).not.toContain('method:pi');
    expect(found).not.toContain('import:randint');
    // A comprehension's `for` is not a loop.
    expect(found).not.toContain('kw:for');
  });

  it('ignores what is inside strings and comments', () => {
    const found = constructsIn('print("def sum(x)")  # while True: lambda');
    expect([...found].sort()).toEqual(['call:print']);
  });

  it('does not count turtle calls as methods', () => {
    expect(constructsIn('import turtle\nturtle.forward(100)')).not.toContain('method:forward');
  });
});

describe('untaughtConstructs', () => {
  const taught = taughtConstructs([
    'n = int(input())\ntotal = 0\nfor i in range(n):\n    total = total + i\nprint(total)',
    'if x > 0:\n    print("+")\nelif x < 0:\n    print("-")\nelse:\n    print(0)'
  ]);

  it('reports what nothing taught so far uses, as code', () => {
    const chatbot = 'n = int(input())\nprint(sum([i for i in range(n)]))';
    expect(untaughtConstructs(chatbot, taught)).toEqual(['[… for …]', 'sum()']);
  });

  it('reports nothing for a program in the lessons’ own terms', () => {
    const student = 'n = int(input())\ns = 0\nfor k in range(n):\n    s = s + k\nprint(s)';
    expect(untaughtConstructs(student, taught)).toEqual([]);
  });
});
