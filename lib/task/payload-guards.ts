/**
 * Structural payload validation shared by the task-authoring routes
 * (POST /api/tasks, PATCH /api/tasks/[id]). An authenticated teacher is a
 * trusted author, not an adversarial student (CLAUDE.md, "Cheating and
 * Trust"), so this only needs to catch a malformed request, not an
 * adversarial one.
 */
import { isFillTemplateValid } from './fill';
import type { CodePayload, FillPayload, FixPayload, ParsonsPayload, PredictPayload, QuizPayload, TaskPayload } from './types';

export function isCodePayload(value: unknown): value is CodePayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'code' &&
    typeof p.surface === 'string' &&
    typeof p.prompt === 'string' &&
    typeof p.starter === 'string'
  );
}

function isParsonsLine(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const line = value as Record<string, unknown>;
  return typeof line.text === 'string' && typeof line.indent === 'number';
}

export function isParsonsPayload(value: unknown): value is ParsonsPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'parsons' &&
    typeof p.prompt === 'string' &&
    Array.isArray(p.lines) &&
    p.lines.length > 0 &&
    p.lines.every(isParsonsLine) &&
    (p.distractors === undefined ||
      (Array.isArray(p.distractors) && p.distractors.every((d) => typeof d === 'string'))) &&
    // 'chosen' is documented but not built yet (lib/task/types.ts) — reject
    // it here rather than storing a payload nothing can grade.
    p.indentMode === 'given'
  );
}

export function isQuizPayload(value: unknown): value is QuizPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'quiz' &&
    typeof p.prompt === 'string' &&
    Array.isArray(p.options) &&
    p.options.length > 0 &&
    p.options.every((o) => typeof o === 'string') &&
    typeof p.multiple === 'boolean'
  );
}

export function isPredictPayload(value: unknown): value is PredictPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'predict' &&
    typeof p.prompt === 'string' &&
    typeof p.code === 'string' &&
    p.code.length > 0 &&
    // 'choice' and imageOptions are documented but not built yet (lib/task/types.ts) — reject
    // them here rather than storing a payload nothing can render or grade.
    p.answerMode === 'text'
  );
}

export function isFixPayload(value: unknown): value is FixPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'fix' &&
    typeof p.surface === 'string' &&
    typeof p.prompt === 'string' &&
    typeof p.broken === 'string' &&
    p.broken.length > 0
  );
}

export function isFillPayload(value: unknown): value is FillPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    p.type === 'fill' &&
    typeof p.prompt === 'string' &&
    typeof p.template === 'string' &&
    // A template with no {{n}} gap is just a code task — reject it here
    // rather than storing a fill task with nothing for the student to fill.
    isFillTemplateValid(p.template)
  );
}

export function isTaskPayload(value: unknown): value is TaskPayload {
  return (
    isCodePayload(value) ||
    isParsonsPayload(value) ||
    isQuizPayload(value) ||
    isPredictPayload(value) ||
    isFixPayload(value) ||
    isFillPayload(value)
  );
}
