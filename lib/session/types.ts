/**
 * The session contract as the student surfaces see it. Pure types, no database
 * import — components read this, not lib/db/, so the guardrail that keeps the
 * database behind route handlers and server components (CLAUDE.md rule 4) has
 * nothing to catch here even on a type-only import.
 */
import type { CodeTask } from '@/lib/task/types';

export interface JoinableSession {
  id: string;
  code: string;
  mode: 'practice' | 'graded';
  hintsEnabled: boolean;
  timeLimitS: number | null;
  className: string;
  /** Display names the teacher entered. The student picks theirs; nobody types one in. */
  roster: string[];
  /** In the order the teacher set — shuffle is not implemented yet (docs/TASKS.md). */
  tasks: CodeTask[];
}

export interface AttemptInput {
  sessionId: string;
  studentName: string;
  taskId: string;
  taskVersion: number;
  code: string;
  passed: boolean;
  hintsUsed: number;
  durationMs: number;
}
