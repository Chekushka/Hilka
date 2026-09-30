/**
 * Limiters for the two public auth entry points that are not magic links:
 * the superuser's password form (a guessable secret, so few tries) and the
 * teacher sign-up form (writes a row per new address, so a cap on flooding).
 * Same in-memory, per-instance limiter as progress codes, with the same
 * caveat (docs/AI_CONTEXT.md, Gotchas).
 */
import { createFixedWindowLimiter } from '@/lib/practice/rate-limit';

/** Counts failed superuser logins only (app/api/admin/login/route.ts). */
export const superuserLoginLimiter = createFixedWindowLimiter(5, 15 * 60 * 1000);
export const signupLimiter = createFixedWindowLimiter(10, 60 * 60 * 1000);

export function clientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
