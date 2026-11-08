/**
 * Colours for the static code in a lesson's theory (components/lesson/): a
 * small tokenizer for the Python students meet — keywords, strings, numbers,
 * comments, built-in functions — so a code example reads at a glance instead
 * of as one grey block. Pure and display-only: nothing here runs or judges
 * code, and anything it does not recognize stays plain text.
 *
 * Also splits a `notes` block's trailing comments off its lines: the theory
 * shows them as notes a student taps open, one line at a time.
 */

export type TokenKind = 'keyword' | 'string' | 'number' | 'comment' | 'builtin' | 'call' | 'plain';

export interface Token {
  kind: TokenKind;
  text: string;
}

const KEYWORDS = new Set([
  'and', 'as', 'break', 'continue', 'def', 'elif', 'else', 'False', 'for', 'from', 'if', 'import',
  'in', 'is', 'None', 'not', 'or', 'pass', 'return', 'True', 'while', 'try', 'except', 'finally', 'with'
]);

const BUILTINS = new Set([
  'print', 'input', 'int', 'float', 'str', 'bool', 'range', 'round', 'type', 'len', 'abs', 'min', 'max', 'sum'
]);

// Order matters: a comment or string swallows anything inside it.
const PATTERN =
  /(#.*$)|([fFrR]?"(?:[^"\\]|\\.)*"?|[fFrR]?'(?:[^'\\]|\\.)*'?)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_Ѐ-ӿ][\wЀ-ӿ]*)/gm;

/** One line's tokens; adjacent plain text is merged, and the texts joined give the line back exactly. */
export function highlightLine(line: string): Token[] {
  const tokens: Token[] = [];
  const push = (kind: TokenKind, text: string) => {
    if (text === '') return;
    const last = tokens[tokens.length - 1];
    if (kind === 'plain' && last?.kind === 'plain') last.text += text;
    else tokens.push({ kind, text });
  };
  let at = 0;
  for (const match of line.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    push('plain', line.slice(at, start));
    const [text, comment, string, number, word] = match;
    if (comment) push('comment', text);
    else if (string) push('string', text);
    else if (number) push('number', text);
    else if (word) {
      const rest = line.slice(start + text.length);
      if (KEYWORDS.has(text)) push('keyword', text);
      else if (BUILTINS.has(text) && /^\s*\(/.test(rest)) push('builtin', text);
      else if (/^\s*\(/.test(rest)) push('call', text);
      else push('plain', text);
    }
    at = start + text.length;
  }
  push('plain', line.slice(at));
  return tokens;
}

export function highlightCode(code: string): Token[][] {
  return code.split('\n').map(highlightLine);
}

export interface NotedLine {
  /** The line without its trailing comment, spaces before it removed. */
  code: Token[];
  /** The comment's text without `#`, or null — a line that is only a comment keeps it as code. */
  note: string | null;
}

/**
 * A `notes` block: each line's trailing comment (after some code, never
 * inside a string) becomes a note. A line that is nothing but a comment stays
 * as it is — it is code the student should see.
 */
export function splitNotes(code: string): NotedLine[] {
  return code.split('\n').map((line) => {
    const tokens = highlightLine(line);
    const last = tokens[tokens.length - 1];
    const hasCode = tokens.some((token) => token.kind !== 'comment' && token.text.trim() !== '');
    if (!last || last.kind !== 'comment' || !hasCode) return { code: tokens, note: null };
    const body = tokens.slice(0, -1);
    const tail = body[body.length - 1];
    if (tail?.kind === 'plain') {
      const trimmed = tail.text.replace(/\s+$/, '');
      if (trimmed === '') body.pop();
      else body[body.length - 1] = { ...tail, text: trimmed };
    }
    const note = last.text.replace(/^#\s*/, '').trim();
    return { code: body, note: note === '' ? null : note };
  });
}
