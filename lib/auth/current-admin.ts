/**
 * Whether this request comes from the superuser, for a server component or
 * route handler to check (lib/auth/superuser.ts). Reads the admin cookie
 * against the current environment each time, so an unset or changed
 * password hash ends every session.
 */
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, isValidAdminCookie } from './admin-cookie';
import { secret } from './session-cookie';
import { superuserConfig } from './superuser';

export async function isSuperuser(): Promise<boolean> {
  const config = superuserConfig(process.env);
  if (!config) return false;
  const store = await cookies();
  return isValidAdminCookie(store.get(ADMIN_COOKIE_NAME)?.value, config.passwordHash, secret());
}
