/**
 * Shared limiter instance for `/api/progress` and `/api/progress/restore` —
 * both accept a client-supplied code, so both need the same guard against
 * guessing one (docs/AI_CONTEXT.md, "Progress Codes").
 */
import { createFixedWindowLimiter } from './rate-limit';

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 5 * 60 * 1000;

export const progressCodeLimiter = createFixedWindowLimiter(MAX_ATTEMPTS, WINDOW_MS);

export function progressClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
