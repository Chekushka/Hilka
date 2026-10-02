/**
 * A Python tokenizer just good enough to compare programs and spot
 * constructs (./similar.ts, ./constructs.ts): names, numbers, strings
 * (f-strings marked), operators and brackets, and one `newline` token per
 * non-empty line carrying its indentation level. Comments are dropped. No
 * grammar, no errors — a program that does not parse still tokenizes, which
 * is what a teacher-facing fact needs. Pure.
 */

export type Token =
  | { kind: 'name'; text: string }
  | { kind: 'number'; text: string }
  | { kind: 'string'; text: string; fstring: boolean }
  | { kind: 'op'; text: string }
  /** Starts every non-empty line; `level` is its indentation depth, 0 at the margin. */
  | { kind: 'newline'; level: number };

const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{N}_]/u;
const STRING_PREFIX = /^([rRbBuUfF]{1,2})?(['"])/;
const TWO_CHAR_OPS = new Set(['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/=', '%=', '->', ':=']);

/** The end of a string literal starting at `i` (at its opening quote). */
function stringEnd(source: string, i: number): number {
  const quote = source[i];
  const triple = source.startsWith(quote.repeat(3), i);
  const closer = triple ? quote.repeat(3) : quote;
  let j = i + closer.length;
  while (j < source.length) {
    if (source[j] === '\\') {
      j += 2;
      continue;
    }
    if (source.startsWith(closer, j)) return j + closer.length;
    if (!triple && source[j] === '\n') return j;
    j += 1;
  }
  return j;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const indentWidths: number[] = [0];
  let depth = 0; // open brackets: a line break inside them continues the line
  let atLineStart = true;
  let i = 0;

  while (i < source.length) {
    if (atLineStart && depth === 0) {
      let width = 0;
      while (i < source.length && (source[i] === ' ' || source[i] === '\t')) {
        width += source[i] === '\t' ? 4 : 1;
        i += 1;
      }
      if (i >= source.length) break;
      if (source[i] === '\n' || source[i] === '\r' || source[i] === '#') {
        while (i < source.length && source[i] !== '\n') i += 1;
        i += 1;
        continue;
      }
      while (width < indentWidths[indentWidths.length - 1]) indentWidths.pop();
      if (width > indentWidths[indentWidths.length - 1]) indentWidths.push(width);
      tokens.push({ kind: 'newline', level: indentWidths.length - 1 });
      atLineStart = false;
    }

    const ch = source[i];
    if (ch === '\n') {
      atLineStart = true;
      i += 1;
      continue;
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '#') {
      while (i < source.length && source[i] !== '\n') i += 1;
      continue;
    }

    const prefix = STRING_PREFIX.exec(source.slice(i, i + 3));
    if (prefix) {
      const start = i + (prefix[1]?.length ?? 0);
      const end = stringEnd(source, start);
      tokens.push({ kind: 'string', text: source.slice(i, end), fstring: /f/i.test(prefix[1] ?? '') });
      i = end;
      continue;
    }

    if (NAME_START.test(ch)) {
      let j = i + 1;
      while (j < source.length && NAME_PART.test(source[j])) j += 1;
      tokens.push({ kind: 'name', text: source.slice(i, j) });
      i = j;
      continue;
    }

    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let j = i + 1;
      while (j < source.length && /[0-9a-zA-Z_.]/.test(source[j])) j += 1;
      tokens.push({ kind: 'number', text: source.slice(i, j) });
      i = j;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (TWO_CHAR_OPS.has(two)) {
      tokens.push({ kind: 'op', text: two });
      i += 2;
      continue;
    }
    if ('([{'.includes(ch)) depth += 1;
    if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
    tokens.push({ kind: 'op', text: ch });
    i += 1;
  }
  return tokens;
}
