/**
 * Unicode-aware replacements for Skulpt's ASCII-only `str` methods.
 *
 * Skulpt implements `isalpha`, `isalnum`, `isupper`, `islower`, `istitle`,
 * `title` and `swapcase` with `[a-zA-Z]` regexes, so on Ukrainian text they
 * answer wrongly and silently: `"абв".isalpha()` is `False`, `"кіт".title()`
 * is unchanged (AI_CONTEXT.md, Gotchas). A platform teaching Python in
 * Ukrainian cannot grade string tasks on that.
 *
 * Each replacement ports CPython's own algorithm (Objects/unicodeobject.c)
 * onto JS's Unicode property escapes, using the same properties CPython's
 * tables are built from: `Uppercase`/`Lowercase` (not just `Lu`/`Ll`),
 * `Lt` for titlecase, `Cased`. `upper`, `lower` and `capitalize` already use
 * JS's Unicode case mapping and are left alone. Proven against real CPython
 * by the safe-subset corpus (scripts/safe-subset/corpus.ts).
 *
 * Known remaining gaps, not worth the code for this curriculum: Greek final
 * sigma inside `title`/`swapcase`, and `isalnum` counting all of `\p{N}` where
 * CPython uses its narrower Numeric_Type table.
 */
import type { SkulptGlobal, SkulptStr } from '../skulpt.d';

interface Classes {
  letter: RegExp;
  alnum: RegExp;
  upper: RegExp;
  lower: RegExp;
  title: RegExp;
  cased: RegExp;
}

/**
 * Built at runtime, not as literals: an engine without Unicode property
 * escapes (Chrome < 64, Firefox < 78) would otherwise throw a SyntaxError at
 * load and take the whole Worker down. There, the patch is skipped and
 * Skulpt's ASCII behaviour remains.
 */
function compileClasses(): Classes | null {
  try {
    return {
      letter: new RegExp('^\\p{L}$', 'u'),
      alnum: new RegExp('^[\\p{L}\\p{N}]$', 'u'),
      upper: new RegExp('^\\p{Uppercase}$', 'u'),
      lower: new RegExp('^\\p{Lowercase}$', 'u'),
      title: new RegExp('^\\p{Lt}$', 'u'),
      cased: new RegExp('^\\p{Cased}$', 'u')
    };
  } catch {
    return null;
  }
}

/**
 * Titlecase differs from uppercase only for these digraphs (Unicode's `Lt`
 * mappings); JS has no titlecase function of its own.
 */
const TITLECASE: Record<string, string> = {
  'Ǆ': 'ǅ', 'ǅ': 'ǅ', 'ǆ': 'ǅ',
  'Ǉ': 'ǈ', 'ǈ': 'ǈ', 'ǉ': 'ǈ',
  'Ǌ': 'ǋ', 'ǋ': 'ǋ', 'ǌ': 'ǋ',
  'Ǳ': 'ǲ', 'ǲ': 'ǲ', 'ǳ': 'ǲ'
};

function toTitle(ch: string, cased: RegExp): string {
  const mapped = TITLECASE[ch];
  if (mapped) return mapped;
  // A full uppercase mapping can expand ("ß" → "SS", "ﬁ" → "FI", "ŉ" → "ʼN").
  // Its titlecase (Unicode SpecialCasing) keeps everything up to and
  // including the first cased character, lowercasing the rest: "Ss", "Fi",
  // "ʼN" — not simply the first character, which would give "ʼn".
  const parts = Array.from(ch.toUpperCase());
  const firstCased = parts.findIndex((part) => cased.test(part));
  if (firstCased < 0) return parts.join('');
  return parts.slice(0, firstCased + 1).join('') + parts.slice(firstCased + 1).join('').toLowerCase();
}

export function strMethods(c: Classes) {
  const all = (s: string, re: RegExp) => s.length > 0 && Array.from(s).every((ch) => re.test(ch));

  return {
    isalpha: (s: string) => all(s, c.letter),
    isalnum: (s: string) => all(s, c.alnum),
    /** All cased characters uppercase, and at least one cased. */
    isupper: (s: string) => {
      let cased = false;
      for (const ch of s) {
        if (c.lower.test(ch) || c.title.test(ch)) return false;
        if (c.upper.test(ch)) cased = true;
      }
      return cased;
    },
    islower: (s: string) => {
      let cased = false;
      for (const ch of s) {
        if (c.upper.test(ch) || c.title.test(ch)) return false;
        if (c.lower.test(ch)) cased = true;
      }
      return cased;
    },
    istitle: (s: string) => {
      let cased = false;
      let previousCased = false;
      for (const ch of s) {
        if (c.upper.test(ch) || c.title.test(ch)) {
          if (previousCased) return false;
          previousCased = true;
          cased = true;
        } else if (c.lower.test(ch)) {
          if (!previousCased) return false;
          previousCased = true;
          cased = true;
        } else {
          previousCased = false;
        }
      }
      return cased;
    },
    /** Whether the *original* character was cased decides the next one, as in CPython's do_title. */
    title: (s: string) => {
      let out = '';
      let previousCased = false;
      for (const ch of s) {
        out += previousCased ? ch.toLowerCase() : toTitle(ch, c.cased);
        previousCased = c.cased.test(ch);
      }
      return out;
    },
    swapcase: (s: string) => {
      let out = '';
      for (const ch of s) {
        if (c.upper.test(ch)) out += ch.toLowerCase();
        else if (c.lower.test(ch)) out += ch.toUpperCase();
        else out += ch;
      }
      return out;
    }
  };
}

/**
 * Replaces the methods on `str` itself. Both places a method descriptor keeps
 * its function are patched: `$meth` (called through the type, `str.isalpha(s)`)
 * and `d$def.$meth` (what a bound method, `s.isalpha`, is built from).
 * Returns whether the patch was applied.
 */
export function patchStrUnicode(Sk: SkulptGlobal): boolean {
  const classes = compileClasses();
  if (!classes) return false;
  const methods = strMethods(classes);
  const proto = Sk.builtin.str.prototype;

  const install = (name: keyof typeof methods, wrap: (this: SkulptStr) => unknown) => {
    const descriptor = proto[name];
    if (!descriptor) return;
    descriptor.$meth = wrap;
    descriptor.d$def.$meth = wrap;
  };
  const predicate = (name: 'isalpha' | 'isalnum' | 'isupper' | 'islower' | 'istitle') =>
    install(name, function (this: SkulptStr) {
      return methods[name](this.v) ? Sk.builtin.bool.true$ : Sk.builtin.bool.false$;
    });
  const transform = (name: 'title' | 'swapcase') =>
    install(name, function (this: SkulptStr) {
      return new Sk.builtin.str(methods[name](this.v));
    });

  predicate('isalpha');
  predicate('isalnum');
  predicate('isupper');
  predicate('islower');
  predicate('istitle');
  transform('title');
  transform('swapcase');
  return true;
}
