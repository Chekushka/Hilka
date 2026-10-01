/**
 * Whether this request comes from the superuser, for a server component or
 * route handler to check (lib/auth/superuser.ts). Reads the admin cookie
 * against the current environment each time, so an unset or changed
 * password hash ends every session, and a missing AUTH_SECRET means nobody
 * is the superuser rather than a crash.
 */
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from './admin-cookie';
import { superuserReadiness } from './superuser';

/** False, never a throw, when the superuser is not configured — the login page says why. */
export async function isSuperuser(): Promise<boolean> {
  const readiness = superuserReadiness(process.env);
  if (!readiness.ready) return false;
  const store = await cookies();
  return isValidAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value, readiness.config.passwordHash, readiness.secret);
}
