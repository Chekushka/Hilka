/**
 * The superuser (docs/AI_CONTEXT.md, "Teacher Auth"): approves teacher
 * sign-ups and manages who may log in. Not a row in `teachers` and not a
 * magic-link login — a login and a password hash set in the environment,
 * so it works on a fresh database and when email delivery does not.
 *
 *   SUPERUSER_LOGIN          any name, e.g. `admin`
 *   SUPERUSER_PASSWORD_HASH  from `npm run superuser:hash`
 *   SUPERUSER_EMAIL          optional: where new sign-up requests are announced
 *                            (lib/auth/access-email.ts). Not a login.
 *
 * Unset or malformed, the superuser does not exist: /admin/login refuses
 * every attempt. Fails closed, never open.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { isPlausibleEmail, normalizeEmail } from './email';
import { parsePasswordHash, verifyPassword } from './password';

export interface SuperuserConfig {
  login: string;
  passwordHash: string;
}

export function superuserConfig(env: Record<string, string | undefined>): SuperuserConfig | null {
  const login = env.SUPERUSER_LOGIN?.trim();
  const passwordHash = env.SUPERUSER_PASSWORD_HASH?.trim();
  if (!login || !passwordHash || !parsePasswordHash(passwordHash)) return null;
  return { login, passwordHash };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

/**
 * Both halves are always checked, so a wrong login takes as long as a wrong
 * password — the response time says nothing about which one was wrong.
 */
export function checkSuperuserCredentials(login: string, password: string, config: SuperuserConfig): boolean {
  const loginMatches = timingSafeEqual(digest(login.trim()), digest(config.login));
  const passwordMatches = verifyPassword(password, config.passwordHash);
  return loginMatches && passwordMatches;
}

/** Where new sign-up requests are announced; null when unset or not an address. */
export function superuserEmail(env: Record<string, string | undefined>): string | null {
  const email = normalizeEmail(env.SUPERUSER_EMAIL ?? '');
  return isPlausibleEmail(email) ? email : null;
}
