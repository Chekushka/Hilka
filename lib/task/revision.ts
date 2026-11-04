/**
 * Editing a published task (docs/TASKS.md, "Editing a published task"). A
 * published task is never changed in place: the teacher opens a revision — a
 * copy of the editable fields in `tasks.revision` — edits it in the same
 * editors a draft uses, and publishes it through the same gate. Until then
 * students go on seeing the live columns, which is what makes it safe to edit
 * a task a class is working on (docs/AI_CONTEXT.md, "Database Schema").
 *
 * Pure: the route handlers read the row, decide here, and write through
 * lib/db/task-authoring.ts.
 */
import type { Check } from '@/lib/checker';
import type { ParamSpec } from '@/lib/seed';
import type { RunCase, TaskPayload, TaskRevision, TaskStatus, TaskType } from './types';

/** The parts of a task row these rules read. */
export interface RevisableRow {
  type: TaskType;
  status: TaskStatus;
  title: string;
  payload: TaskPayload | null;
  checks: Check[] | null;
  cases: RunCase[] | null;
  hints: string[] | null;
  difficulty: number;
  gradeTags: number[] | null;
  params: ParamSpec | null;
  revision: TaskRevision | null;
}

/**
 * - `draft`: edited in place, never published.
 * - `revision`: published, with a revision open — the editor works on it.
 * - `published`: published, nothing open; a revision can be started.
 * - `locked`: published but cannot be revised here (see `revisionBlocker`),
 *   or archived.
 */
export type AuthoringMode = 'draft' | 'revision' | 'published' | 'locked';

export type RevisionBlocker = 'not_published' | 'parameterized' | 'no_payload';

/**
 * Why a revision cannot be started, or `null` when it can. A parameterized
 * task's prompt, reference and checks carry `{name}` placeholders that only
 * resolve per student (docs/TASK_SCHEMA.md, "Parameterization"); the editors
 * run the reference as written and have no params editor, so such a task
 * stays hand-authored JSON, as it was created.
 */
export function revisionBlocker(row: RevisableRow): RevisionBlocker | null {
  if (row.status !== 'published') return 'not_published';
  if (row.payload === null) return 'no_payload';
  if (row.params !== null) return 'parameterized';
  return null;
}

export function authoringModeOf(row: RevisableRow): AuthoringMode {
  if (row.status === 'draft') return 'draft';
  if (row.status === 'published' && row.revision !== null) return 'revision';
  return revisionBlocker(row) === null ? 'published' : 'locked';
}

/** The live version's editable fields — what a new revision starts from. */
export function revisionFromRow(row: RevisableRow & { payload: TaskPayload }): TaskRevision {
  return {
    title: row.title,
    payload: row.payload,
    checks: row.checks ?? [],
    cases: row.cases && row.cases.length > 0 ? row.cases : null,
    hints: row.hints ?? [],
    difficulty: row.difficulty,
    gradeTags: row.gradeTags ?? []
  };
}

/**
 * What the editor shows and the publish gate judges: a draft's own columns,
 * or a published task's open revision. `null` when there is nothing to edit.
 */
export function editableContent(row: RevisableRow): TaskRevision | null {
  const mode = authoringModeOf(row);
  if (mode === 'revision') return row.revision;
  if (mode === 'draft' && row.payload !== null) return revisionFromRow({ ...row, payload: row.payload });
  return null;
}

/** A save to a revision, in `PATCH /api/tasks/[id]`'s shape: absent fields stay as they are. */
export type RevisionPatch = Partial<TaskRevision>;

/**
 * Applies a save to an open revision. `type` is fixed: a revision that
 * changed it would make every earlier attempt's answer unreadable (they are
 * read by type — lib/dashboard/submitted-answer.ts), so it is refused.
 */
export function applyRevisionPatch(
  type: TaskType,
  revision: TaskRevision,
  patch: RevisionPatch
): { ok: true; revision: TaskRevision } | { ok: false; error: 'type_changed' } {
  if (patch.payload && patch.payload.type !== type) {
    return { ok: false, error: 'type_changed' };
  }
  const next: TaskRevision = { ...revision };
  if (patch.title !== undefined) next.title = patch.title;
  if (patch.payload !== undefined) next.payload = patch.payload;
  if (patch.checks !== undefined) next.checks = patch.checks;
  if (patch.cases !== undefined) next.cases = patch.cases && patch.cases.length > 0 ? patch.cases : null;
  if (patch.hints !== undefined) next.hints = patch.hints;
  if (patch.difficulty !== undefined) next.difficulty = patch.difficulty;
  if (patch.gradeTags !== undefined) next.gradeTags = patch.gradeTags;
  return { ok: true, revision: next };
}
