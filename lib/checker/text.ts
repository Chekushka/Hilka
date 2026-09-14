/** Text and number handling shared by the output checks. */

/**
 * 'trim' removes leading and trailing whitespace only.
 * 'loose' also collapses runs of whitespace and ignores case — enough to
 * forgive a double space or a capital letter, not enough to accept a different
 * answer. Decimal commas are deliberately not handled here: a number that
 * should be compared as a number belongs in number_close, not in text_equals.
 */
export function normalizeText(value: string, mode?: 'trim' | 'loose'): string {
  if (mode === 'loose') {
    return value.trim().replace(/\s+/g, ' ').toLowerCase();
  }
  if (mode === 'trim') {
    return value.trim();
  }
  return value;
}

export function lastLine(stdout: string): string {
  const lines = stdout.replace(/\s+$/, '').split('\n');
  return lines.length > 0 ? lines[lines.length - 1] : '';
}

/**
 * Every number in the output, in order. A comma directly between digits is a
 * decimal separator — a student typing 22,86 is not wrong — while a comma
 * followed by a space is a list separator and splits the numbers.
 */
export function extractNumbers(stdout: string): number[] {
  const matches = stdout.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches) {
    return [];
  }
  return matches.map((raw) => Number(raw.replace(',', '.')));
}
