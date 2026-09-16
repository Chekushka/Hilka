/**
 * Shared between NewTaskForm and EditTaskForm: turning the plain-text fields
 * a teacher can actually type (one hint per line, "7, 8" for grades) into the
 * typed values the API expects, and back.
 */
import type { Check } from '@/lib/checker';

export function parseHints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function parseGradeTags(text: string): number[] {
  return text
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export interface ParsedChecks {
  ok: true;
  checks: Check[];
}

export interface InvalidChecks {
  ok: false;
}

/** Structural only, matching what the API itself trusts from a teacher — see app/api/tasks/route.ts. */
export function parseChecksJson(text: string): ParsedChecks | InvalidChecks {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const isCheckShaped = (v: unknown): boolean =>
    typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string';
  if (!Array.isArray(value) || !value.every(isCheckShaped)) {
    return { ok: false };
  }
  return { ok: true, checks: value as Check[] };
}
