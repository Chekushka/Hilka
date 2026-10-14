/**
 * School computers (docs/AI_CONTEXT.md, "School Computers"): a classroom PC is
 * shared, so a browser marked as one keeps nothing about a student once they
 * leave it. The mark is a cookie rather than localStorage so the server sees
 * it too — teacher login on a marked PC ends with the browser
 * (`createTeacherCookie`). It says something about the machine, never about
 * whoever sits at it.
 *
 * Pure: the browser side is lib/device/school-client.ts.
 */

export const SCHOOL_COOKIE_NAME = 'hilka_school';
export const SCHOOL_COOKIE_VALUE = '1';
/** A machine property, so it outlives any one student by far. */
export const SCHOOL_COOKIE_MAX_AGE_S = 5 * 365 * 24 * 60 * 60;

/**
 * Practice progress on a marked PC is dropped after this long with no key
 * press or click: the browser is often left open between lessons, and the next
 * student must not continue as the last one. Long enough for a student
 * thinking over one task; shorter than a break plus the next lesson's start.
 */
export const SCHOOL_IDLE_MS = 20 * 60 * 1000;

export function isSchoolCookieValue(value: string | undefined | null): boolean {
  return value === SCHOOL_COOKIE_VALUE;
}

/** Whether a `Cookie` header (or `document.cookie`) carries the school mark. */
export function hasSchoolMark(cookieHeader: string): boolean {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .some((part) => part === `${SCHOOL_COOKIE_NAME}=${SCHOOL_COOKIE_VALUE}`);
}

/** True when the last activity is known and older than `SCHOOL_IDLE_MS`. A clock moved backwards counts as active. */
export function isIdleExpired(lastActiveMs: number | null, nowMs: number): boolean {
  return lastActiveMs !== null && nowMs - lastActiveMs > SCHOOL_IDLE_MS;
}
