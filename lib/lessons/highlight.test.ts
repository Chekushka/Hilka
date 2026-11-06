import { describe, expect, it } from 'vitest';
import { highlightCode, highlightLine, splitNotes } from './highlight';

describe('highlightLine', () => {
  it('colours keywords, built-ins, calls, strings, numbers and comments', () => {
    expect(highlightLine('for i in range(4):  # чотири')).toEqual([
      { kind: 'keyword', text: 'for' },
      { kind: 'plain', text: ' i ' },
      { kind: 'keyword', text: 'in' },
      { kind: 'plain', text: ' ' },
      { kind: 'builtin', text: 'range' },
      { kind: 'plain', text: '(' },
      { kind: 'number', text: '4' },
      { kind: 'plain', text: '):  ' },
      { kind: 'comment', text: '# чотири' }
    ]);
    expect(highlightLine('turtle.forward(1.5)')).toEqual([
      { kind: 'plain', text: 'turtle.' },
      { kind: 'call', text: 'forward' },
      { kind: 'plain', text: '(' },
      { kind: 'number', text: '1.5' },
      { kind: 'plain', text: ')' }
    ]);
  });

  it('keeps a # inside a string as part of the string, f-strings included', () => {
    expect(highlightLine('print("# 1", f\'{x}\')')).toEqual([
      { kind: 'builtin', text: 'print' },
      { kind: 'plain', text: '(' },
      { kind: 'string', text: '"# 1"' },
      { kind: 'plain', text: ', ' },
      { kind: 'string', text: "f'{x}'" },
      { kind: 'plain', text: ')' }
    ]);
  });

  it('does not colour a name that only looks like a built-in, nor digits inside a name', () => {
    expect(highlightLine('print = x2')).toEqual([{ kind: 'plain', text: 'print = x2' }]);
  });

  it('gives every line back exactly when the tokens are joined', () => {
    const code = 'name = input("Як? ")\nif name == "Оля":\n    print(f"Привіт, {name}!")   # вітання\n\n';
    expect(
      highlightCode(code)
        .map((line) => line.map((token) => token.text).join(''))
        .join('\n')
    ).toBe(code);
  });
});

describe('splitNotes', () => {
  it('turns a trailing comment into a note and keeps a comment-only line as code', () => {
    const [first, second, third] = splitNotes('# лічильник\nn = 1   # починаємо з 1\nprint("# 1")');
    expect(first).toEqual({ code: [{ kind: 'comment', text: '# лічильник' }], note: null });
    expect(second.note).toBe('починаємо з 1');
    expect(second.code.map((token) => token.text).join('')).toBe('n = 1');
    expect(third.note).toBeNull();
  });
});
