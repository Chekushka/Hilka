import { describe, expect, it } from 'vitest';
import { extractNames } from './ast';

describe('extractNames', () => {
  it('finds a keyword used as a statement', () => {
    expect(extractNames('for i in range(3):\n    pass').has('for')).toBe(true);
  });

  it('does not match a keyword hiding inside a longer identifier', () => {
    // forbids: ['while'] must not fire on a variable named whileCount.
    const names = extractNames('whileCount = 0\nwhileCount += 1');
    expect(names.has('while')).toBe(false);
    expect(names.has('whileCount')).toBe(true);
  });

  it('does not match a name that only appears inside a string literal', () => {
    // uses: { all: ['for'] } must not be satisfied by the word inside a string.
    expect(extractNames('print("for the win")').has('for')).toBe(false);
  });

  it('ignores names inside a triple-quoted string', () => {
    const source = '"""\nfor i in range(3):\n    print(i)\n"""';
    expect(extractNames(source).has('for')).toBe(false);
  });

  it('ignores a name that only appears in a comment', () => {
    expect(extractNames('x = 1  # while not done').has('while')).toBe(false);
  });

  it('records a dotted attribute path alongside its parts', () => {
    const names = extractNames('turtle.forward(100)');
    expect(names.has('turtle.forward')).toBe(true);
    expect(names.has('turtle')).toBe(true);
    expect(names.has('forward')).toBe(true);
  });

  it('handles an escaped quote inside a string without ending it early', () => {
    const names = extractNames('print("say \\"for\\"")\nfor i in range(1):\n    pass');
    expect(names.has('for')).toBe(true); // from the real loop, not the string
    expect(extractNames('print("say \\"for\\"")').has('for')).toBe(false);
  });

  it('treats an f-string prefix as part of the string, not a name', () => {
    const names = extractNames('x = f"for {y}"');
    expect(names.has('for')).toBe(false);
    expect(names.has('f')).toBe(false);
  });
});
