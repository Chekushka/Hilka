/**
 * Limiters for `/api/progress` and `/api/progress/restore` — both accept a
 * client-supplied code, so both guard against guessing one
 * (docs/AI_CONTEXT.md, "Progress Codes"). Keyed by IP, and a whole classroom
 * sits behind one school IP: on a school computer every change is saved at
 * once and every student restores their code at the start of a lesson
 * (docs/AI_CONTEXT.md, "School Computers"), so the budgets are a class's worth.
 * Guessing stays hopeless at these rates — 31^8 codes.
 */
import { createFixedWindowLimiter } from './rate-limit';

const WINDOW_MS = 5 * 60 * 1000;

/** Saves: about 30 students, a few changes each per five minutes. */
export const progressSaveLimiter = createFixedWindowLimiter(300, WINDOW_MS);

/** Restores: a class entering their codes at once, with retries for typos. */
export const progressRestoreLimiter = createFixedWindowLimiter(90, WINDOW_MS);

export function progressClientKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}
