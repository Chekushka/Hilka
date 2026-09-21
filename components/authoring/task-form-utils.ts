/**
 * Shared between NewTaskForm and EditTaskForm: turning the plain-text fields
 * a teacher can actually type (one hint per line, "7, 8" for grades) into the
 * typed values the API expects, and back.
 */
import type { Check } from '@/lib/checker';
import type { RunCase } from '@/lib/task/types';

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

function isCheckShaped(v: unknown): boolean {
  return typeof v === 'object' && v !== null && typeof (v as { kind?: unknown }).kind === 'string';
}

/** Structural only, matching what the API itself trusts from a teacher — see app/api/tasks/route.ts. */
export function parseChecksJson(text: string): ParsedChecks | InvalidChecks {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  if (!Array.isArray(value) || !value.every(isCheckShaped)) {
    return { ok: false };
  }
  return { ok: true, checks: value as Check[] };
}

export interface ParsedCases {
  ok: true;
  cases: RunCase[];
}

export interface InvalidCases {
  ok: false;
}

/** Structural only, same trust boundary as parseChecksJson — see app/api/tasks/route.ts. */
export function parseCasesJson(text: string): ParsedCases | InvalidCases {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false };
  }
  const isCaseShaped = (v: unknown): boolean => {
    if (typeof v !== 'object' || v === null) return false;
    const c = v as Record<string, unknown>;
    return (
      Array.isArray(c.stdin) &&
      c.stdin.every((line) => typeof line === 'string') &&
      (c.checks === undefined || (Array.isArray(c.checks) && c.checks.every(isCheckShaped))) &&
      (c.label === undefined || typeof c.label === 'string') &&
      (c.hidden === undefined || typeof c.hidden === 'boolean')
    );
  };
  if (!Array.isArray(value) || !value.every(isCaseShaped)) {
    return { ok: false };
  }
  return { ok: true, cases: value as RunCase[] };
}
