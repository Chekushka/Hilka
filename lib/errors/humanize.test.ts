import { describe, expect, it } from 'vitest';
import { humanize, humanizeTimeout } from './humanize';
import { unmatchedErrors } from './unmatched';
import type { PyError } from '@/lib/runner';

/**
 * Every message string below was recorded by running the mistake through
 * Skulpt, not remembered from CPython. Skulpt's wording differs, and a rule
 * written against CPython text would never fire.
 */
function err(type: string, message: string, line: number | null = 1): PyError {
  return { type, message, line, col: 0 };
}

describe('rule #1 — arithmetic on input()', () => {
  const message = "cannot concatenate 'str' and 'int' objects";

  it('explains that input() gives text', () => {
    const result = humanize(err('TypeError', message, 2), 'age = input()\nprint(age + 1)');
    expect(result.ruleId).toBe('input-arithmetic');
    expect(result.explanation).toContain('input() завжди дає текст');
    expect(result.hint).toContain('int(input())');
  });

  it('falls to the general type message when no input() is involved', () => {
    const result = humanize(err('TypeError', message), 'print("вік: " + 12)');
    expect(result.ruleId).toBe('concatenate-types');
    expect(result.explanation).toContain('текст');
  });

  it('never mentions the raw Skulpt wording', () => {
    const result = humanize(err('TypeError', message, 2), 'age = input()\nprint(age + 1)');
    const shown = `${result.title} ${result.explanation} ${result.hint ?? ''}`;
    expect(shown).not.toContain('concatenate');
    expect(shown).not.toContain('TypeError');
  });
});

describe('syntax errors, which Skulpt reports identically', () => {
  // Skulpt says "bad input" for all of these, so the rules read the source.
  const bad = (line: number) => err('SyntaxError', 'bad input', line);

  it('recognizes a missing colon', () => {
    const result = humanize(bad(1), 'for i in range(3)\n    print(i)');
    expect(result.ruleId).toBe('syntax-missing-colon');
    expect(result.title).toContain('двокрапки');
  });

  it('recognizes a line that should be indented', () => {
    const result = humanize(bad(2), 'for i in range(3):\nprint(i)');
    expect(result.ruleId).toBe('syntax-missing-indent');
    expect(result.hint).toContain('чотири пробіли');
  });

  it('recognizes an indent with nothing above it', () => {
    const result = humanize(bad(2), 'x = 1\n    y = 2');
    expect(result.ruleId).toBe('syntax-unexpected-indent');
  });

  it('recognizes an unclosed bracket', () => {
    const result = humanize(err('SyntaxError', 'EOF in multi-line statement', 2), 'print("a"');
    expect(result.ruleId).toBe('syntax-unclosed');
    expect(result.title).toContain('дужка');
  });

  it('recognizes an unclosed quote', () => {
    const result = humanize(bad(1), 'print("hello)');
    expect(result.ruleId).toBe('syntax-unclosed');
    expect(result.title).toContain('лапки');
  });

  it('still says something calm when it cannot tell which mistake it was', () => {
    const result = humanize(bad(1), '5 = x');
    expect(result.ruleId).toBe('syntax-generic');
    expect(result.title).not.toContain('Помилка');
  });
});

describe('the rest of the starter set', () => {
  it('explains an input() with nothing to read', () => {
    // Headless runs consume a queued stdin; reading past the end raises this
    // before any arithmetic on the value can fail, so it needs its own rule.
    const result = humanize(err('EOFError', 'EOF when reading a line'), 'a = input()\nb = input()');
    expect(result.ruleId).toBe('input-without-value');
    expect(result.hint).toContain('input()');
  });

  it('names the unknown name', () => {
    const result = humanize(err('NameError', "name 'pront' is not defined"), 'pront("привіт")');
    expect(result.title).toContain('pront');
    expect(result.ruleId).toBe('name-not-defined');
  });

  it('explains an index that does not exist', () => {
    const result = humanize(err('IndexError', 'list index out of range', 2), 'xs = [1, 2]\nprint(xs[5])');
    expect(result.hint).toContain('0');
  });

  it('explains division by zero without blame', () => {
    const result = humanize(err('ZeroDivisionError', 'integer division or modulo by zero'), 'print(1 / 0)');
    expect(result.title).toContain('нуль');
  });

  it('explains int() of something that is not a number', () => {
    const result = humanize(
      err('ValueError', "invalid literal for int() with base 10: 'привіт'"),
      'print(int("привіт"))'
    );
    expect(result.ruleId).toBe('int-of-text');
    expect(result.hint).toContain('try');
  });

  it('catches a mistyped turtle command', () => {
    const result = humanize(
      err('AttributeError', "module 'turtle' has no attribute 'forwrd'", 2),
      'import turtle\nturtle.forwrd(100)'
    );
    expect(result.title).toContain('forwrd');
  });

  it('translates type names into words a student knows', () => {
    const result = humanize(err('AttributeError', "'int' object has no attribute 'append'", 2), 'x = 5\nx.append(1)');
    expect(result.title).toContain('ціле число');
  });

  it('names a missing module and lists what exists', () => {
    const result = humanize(err('ImportError', 'No module named numpy'), 'import numpy');
    expect(result.explanation).toContain('turtle');
  });
});

describe('what the student is shown', () => {
  it('includes their own failing line', () => {
    const result = humanize(err('NameError', "name 'x' is not defined", 2), 'y = 1\nprint(x)');
    expect(result.sourceLine).toBe('print(x)');
    expect(result.line).toBe(2);
  });

  it('clamps a line Skulpt reports past the end of the program', () => {
    // An unclosed bracket is only detected at end of file.
    const result = humanize(err('SyntaxError', 'EOF in multi-line statement', 2), 'print("a"');
    expect(result.line).toBe(1);
    expect(result.sourceLine).toBe('print("a"');
  });

  it('phrases a timeout as not finishing, not as an error', () => {
    const result = humanizeTimeout();
    expect(result.title).toContain('не завершилася');
    expect(`${result.title} ${result.explanation}`).not.toContain('помилк');
  });

  it('falls back calmly and records the unmatched error for the rule base', () => {
    const before = unmatchedErrors().length;
    const result = humanize(err('RecursionError', 'maximum recursion depth exceeded'), 'f()');
    expect(result.ruleId).toBe('fallback');
    expect(result.explanation).not.toContain('recursion');
    expect(unmatchedErrors().length).toBe(before + 1);
  });
});
