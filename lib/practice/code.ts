/**
 * Progress code format (docs/AI_CONTEXT.md, "Progress Codes"): an
 * 8-character bearer credential for a `progress_codes` row. Pure formatting
 * and validation only, so a client component can reject an obviously bad
 * code before ever asking the network. Generation needs a CSPRNG
 * (`node:crypto`) and lives server-side in `lib/db/progress-codes.ts`
 * instead, so this file stays importable from the browser.
 */
export const PROGRESS_CODE_LENGTH = 8;

/** Uppercase A-Z and 2-9, minus 0/O/1/I/L — the pairs a tired 12-year-old confuses. */
export const PROGRESS_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Case-insensitive; dashes and spaces stripped, so "abcd-efgh" and "ABCDEFGH" are the same code. */
export function normalizeProgressCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidProgressCode(code: string): boolean {
  return code.length === PROGRESS_CODE_LENGTH && [...code].every((char) => PROGRESS_CODE_ALPHABET.includes(char));
}

/** "ABCDEFGH" -> "ABCD-EFGH", legible on a tired classroom monitor. */
export function formatProgressCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}
