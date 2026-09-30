/**
 * A dependency-free signed cookie identifying the logged-in teacher: no
 * server-side session table, since ~5 accounts do not justify one — the
 * same call CLAUDE.md makes about magic-link auth itself. HMAC-SHA256 over
 * `teacherId.expiresAtMs` with a server-only secret; forging one without the
 * secret is infeasible, and expiry is checked on every read.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TEACHER_COOKIE_NAME = 'hilka_teacher';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** AUTH_SECRET, or null when unset or blank. For callers that fail gracefully (the superuser's area). */
export function readAuthSecret(env: Record<string, string | undefined> = process.env): string | null {
  const value = env.AUTH_SECRET?.trim();
  return value ? value : null;
}

/**
 * AUTH_SECRET, or a thrown error — never an empty key. Teacher login fails
 * closed this way on purpose (docs/CI_CD.md, step 5); the superuser's area
 * uses `readAuthSecret` and shows "not configured" instead.
 */
export function secret(): string {
  const value = readAuthSecret();
  if (!value) {
    throw new Error('AUTH_SECRET is not set. See docs/CI_CD.md — required for teacher login.');
  }
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex');
}

export interface TeacherCookie {
  name: string;
  value: string;
  maxAgeS: number;
}

export function createTeacherCookie(teacherId: string): TeacherCookie {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${teacherId}.${expiresAt}`;
  return {
    name: TEACHER_COOKIE_NAME,
    value: `${payload}.${sign(payload)}`,
    maxAgeS: Math.floor(SESSION_TTL_MS / 1000)
  };
}

/** Null for anything missing, malformed, expired, or with a bad signature. */
export function readTeacherId(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return null;
  const [teacherId, expiresAtRaw, signature] = parts;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;

  const expected = Buffer.from(sign(`${teacherId}.${expiresAtRaw}`), 'hex');
  const actual = Buffer.from(signature, 'hex');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  return teacherId;
}
