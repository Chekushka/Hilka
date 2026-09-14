/**
 * Reading the student's source.
 *
 * Skulpt reports `SyntaxError: bad input` for a missing colon, a wrong indent
 * and an unclosed quote alike — the message cannot tell them apart, so the
 * rules look at the line itself. Everything here is a heuristic over text, and
 * each one has to be wrong quietly: a rule that does not recognize a line falls
 * through to the next, and eventually to a calm generic message.
 */

const BLOCK_OPENERS = /^\s*(if|elif|else|for|while|def|class|try|except|finally|with)\b/;

export function lines(code: string): string[] {
  return code.split('\n');
}

/** Skulpt can report a line past the end of the file for an unclosed bracket. */
export function lineAt(code: string, line: number | null): string | undefined {
  if (line === null) return undefined;
  const all = lines(code);
  if (line < 1) return undefined;
  return all[Math.min(line, all.length) - 1];
}

export function previousCodeLine(code: string, line: number | null): string | undefined {
  if (line === null) return undefined;
  const all = lines(code);
  for (let i = Math.min(line, all.length) - 2; i >= 0; i--) {
    if (all[i].trim().length > 0) return all[i];
  }
  return undefined;
}

export function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

export function opensBlock(line: string): boolean {
  return BLOCK_OPENERS.test(line);
}

export function endsWithColon(line: string): boolean {
  return /:\s*(#.*)?$/.test(line);
}

/** A block opener that never got its colon: `for i in range(3)`. */
export function missingColon(line: string | undefined): boolean {
  if (!line) return false;
  return opensBlock(line) && !endsWithColon(line);
}

/** Unbalanced brackets or an odd number of quotes anywhere in the program. */
export function unclosedDelimiter(code: string): '(' | '[' | '{' | 'quote' | null {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  let quote: string | null = null;
  for (const char of code) {
    if (quote) {
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char in pairs) {
      if (stack[stack.length - 1] === pairs[char]) stack.pop();
    }
  }
  if (quote) return 'quote';
  const open = stack.pop();
  return open === '(' || open === '[' || open === '{' ? open : null;
}

/** A line that should have been indented under the colon above it. */
export function shouldBeIndented(code: string, line: number | null): boolean {
  const current = lineAt(code, line);
  const previous = previousCodeLine(code, line);
  if (!current || !previous || current.trim().length === 0) return false;
  return endsWithColon(previous) && indentOf(current) <= indentOf(previous);
}

/** A line indented for no reason: nothing above it opened a block. */
export function indentedWithoutReason(code: string, line: number | null): boolean {
  const current = lineAt(code, line);
  const previous = previousCodeLine(code, line);
  if (!current || !previous || current.trim().length === 0) return false;
  return indentOf(current) > indentOf(previous) && !endsWithColon(previous);
}
