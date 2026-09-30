/**
 * The six-character session code a teacher puts on the projector. Minted in
 * lib/db/session-authoring.ts; typed by a student on the entry page.
 */
export const SESSION_CODE_LENGTH = 6;

/** No 0/O/1/I — same rationale as the practice progress code (lib/practice/code.ts): legible from the back row. */
export const SESSION_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/*
 * A Ukrainian classroom keyboard is usually left on the Cyrillic layout, and
 * these letters look identical to the Latin ones on the projector. A student
 * who types Cyrillic «С» for Latin «C» has done nothing wrong.
 */
const CYRILLIC_LOOKALIKES: Record<string, string> = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  У: 'Y',
  І: 'I'
};

/**
 * What the student typed, as a code: upper case, Cyrillic lookalikes turned
 * Latin, and anything else (spaces, dashes) dropped. Does not check the
 * alphabet — an older or seeded code may use characters minting now avoids,
 * and the server is the one that says whether a session exists.
 */
export function normalizeSessionCode(input: string): string {
  return [...input.toUpperCase()]
    .map((char) => CYRILLIC_LOOKALIKES[char] ?? char)
    .filter((char) => /[A-Z0-9]/.test(char))
    .join('')
    .slice(0, SESSION_CODE_LENGTH);
}

export function isCompleteSessionCode(code: string): boolean {
  return code.length === SESSION_CODE_LENGTH;
}
