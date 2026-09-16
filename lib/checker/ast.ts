/**
 * Just enough Python lexing to answer "does this source use name X" without
 * matching a substring inside a string literal or comment, and without
 * matching a longer identifier that merely contains the name (`whileCount`
 * must not satisfy a check for `while`).
 *
 * This is a tokenizer, not a full parser — no grammar, no statement tree. That
 * is enough for `uses`/`forbids`, which only ever ask "is this keyword, call,
 * or attribute path present", and it keeps this file free of a Python grammar
 * to maintain. Pure, no DOM, no Python — same constraint as the rest of
 * lib/checker/.
 */

const STRING_PREFIX = /^[a-zA-Z]{0,3}(?=['"])/;
const IDENTIFIER_START = /[\p{L}_]/u;
const IDENTIFIER_PART = /[\p{L}\p{N}_]/u;

/**
 * Every NAME token in the source (keywords and identifiers alike — Python's
 * keywords are lexically just names), plus every dotted attribute path built
 * from consecutive `NAME.NAME` runs (so `turtle.forward` is checked both as
 * itself and via its parts). String and comment contents are skipped
 * entirely, so a name inside quotes or after `#` never matches.
 */
export function extractNames(source: string): Set<string> {
  const names = new Set<string>();
  let chain: string[] = [];
  let i = 0;

  const flushChain = () => {
    chain = [];
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i++;
      flushChain();
      continue;
    }

    const prefixMatch = STRING_PREFIX.exec(source.slice(i, i + 3));
    if (prefixMatch !== null) {
      i = skipString(source, i + prefixMatch[0].length);
      flushChain();
      continue;
    }

    if (IDENTIFIER_START.test(ch)) {
      let j = i + 1;
      while (j < source.length && IDENTIFIER_PART.test(source[j])) j++;
      const name = source.slice(i, j);
      names.add(name);
      chain.push(name);
      names.add(chain.join('.'));
      i = j;

      // A dotted chain continues only through `.`, with no space consumed
      // (`turtle .forward` is not idiomatic Python worth supporting, and
      // skipping whitespace here would risk swallowing a newline between
      // unrelated statements).
      if (source[i] === '.') {
        i++;
      } else {
        flushChain();
      }
      continue;
    }

    if (ch !== '.') {
      flushChain();
    }
    i++;
  }

  return names;
}

/** Advances past a string literal (single, double, or triple-quoted). */
function skipString(source: string, quoteStart: number): number {
  const quote = source[quoteStart];
  const triple = source.slice(quoteStart, quoteStart + 3) === quote.repeat(3);
  const closing = triple ? quote.repeat(3) : quote;
  let i = quoteStart + closing.length;

  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source.slice(i, i + closing.length) === closing) {
      return i + closing.length;
    }
    if (!triple && source[i] === '\n') {
      return i; // unterminated single-line string — stop rather than run away
    }
    i++;
  }
  return i;
}
