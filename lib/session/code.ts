/**
 * Session codes: six characters, put on a projector, typed by a student.
 * Pure and unit-tested, like lib/checker/ and lib/seed/ — the parsing here is
 * trivial but the mistakes it prevents (a trailing space from a paste, lower
 * case from a phone keyboard) are not.
 *
 * Unlike progress_codes (docs/AI_CONTEXT.md), session codes are not a bearer
 * credential for anything private — a session holds no personal data, and the
 * whole point of the code is that a class full of strangers can read it off a
 * screen and use it at once. So there is no restricted alphabet here.
 */
const CODE_LENGTH = 6;

/** Strips spaces and dashes and upper-cases, the way a student might type or
 *  paste a code shown as "AB1-23C" or with a stray space. */
export function normalizeSessionCode(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidSessionCode(input: string): boolean {
  return /^[A-Z0-9]{6}$/.test(input);
}

export { CODE_LENGTH };
