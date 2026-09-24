import { describe, expect, it } from 'vitest';
import { runInNode } from '../node';

/**
 * Expected values are CPython 3.11's own output for the same expressions —
 * the corpus (scripts/safe-subset/) re-proves the whole Latin, Greek and
 * Cyrillic range on every CI run; these pin the cases that matter here.
 */
async function py(code: string): Promise<string> {
  const result = await runInNode(code);
  if (result.error) throw new Error(result.error);
  return result.stdout.trim();
}

describe('str letter predicates on Ukrainian text', () => {
  it.each([
    ['абв', 'True True False True False'],
    ['їжак', 'True True False True False'],
    ["м'ята", 'False False False True False'],
    ['ж1', 'False True False True False'],
    ['ЖУК 1', 'False False True False False'],
    ['Жук Їжак', 'False False False False True'],
    ['ЖУк', 'True True False False False'],
    ['', 'False False False False False']
  ])('%j → isalpha isalnum isupper islower istitle = %s', async (s, expected) => {
    const literal = JSON.stringify(s);
    expect(await py(`s = ${literal}\nprint(s.isalpha(), s.isalnum(), s.isupper(), s.islower(), s.istitle())`)).toBe(expected);
  });

  it('works through the type and as a bound method, not only on a literal', async () => {
    expect(await py('print(list(map(str.isalpha, ["ж", "1"])), str.isupper("Ї"))\nf = "жук".islower\nprint(f())')).toBe(
      '[True, False] True\nTrue'
    );
  });
});

describe('str case transforms on Ukrainian text', () => {
  it('title() capitalizes Cyrillic words the way CPython does', async () => {
    expect(await py('print([s.title() for s in ["кіт і пес", "ґанок-їжак", "they\'re", "straße", "ŉ", "ǆemal"]])')).toBe(
      `['Кіт І Пес', 'Ґанок-Їжак', "They'Re", 'Straße', 'ʼN', 'ǅemal']`
    );
  });

  it('swapcase() swaps Cyrillic and expands ß', async () => {
    expect(await py('print([s.swapcase() for s in ["Привіт, СВІТ", "straße"]])')).toBe(`['пРИВІТ, світ', 'STRASSE']`);
  });
});
