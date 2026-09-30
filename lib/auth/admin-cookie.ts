/**
 * The superuser's session: a signed cookie like the teacher's
 * (lib/auth/session-cookie.ts), with its own name, a short life, and the
 * current password hash folded into the signature — changing
 * SUPERUSER_PASSWORD_HASH logs every superuser session out at once. The
 * `admin:` prefix keeps a teacher cookie's signature from ever validating
 * here, even though both use AUTH_SECRET.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const ADMIN_COOKIE_NAME = 'hilka_admin';

const ADMIN_TTL_MS = 8 * 60 * 60 * 1000; // a working day

function sign(expiresAt: string, passwordHash: string, secret: string): string {
  return createHmac('sha256', secret).update(`admin:${expiresAt}:${passwordHash}`).digest('hex');
}

export function createAdminCookieValue(passwordHash: string, secret: string, now: number = Date.now()): string {
  const expiresAt = String(now + ADMIN_TTL_MS);
  return `${expiresAt}.${sign(expiresAt, passwordHash, secret)}`;
}

export const ADMIN_COOKIE_MAX_AGE_S = Math.floor(ADMIN_TTL_MS / 1000);

/** True only for an unexpired cookie signed for this password hash with this secret. */
export function isValidAdminCookie(
  value: string | undefined | null,
  passwordHash: string,
  secret: string,
  now: number = Date.now()
): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 2) return false;
  const [expiresAt, signature] = parts;
  const expires = Number(expiresAt);
  if (!Number.isFinite(expires) || now > expires) return false;
  const expected = Buffer.from(sign(expiresAt, passwordHash, secret), 'hex');
  const actual = Buffer.from(signature, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
