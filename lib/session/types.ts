/**
 * The session join contract: what the join screen and the session runner see.
 * The teacher side (session builder, docs/TASKS.md) does not exist yet, so
 * sessions are created directly in the database for now; this is the shape a
 * builder UI will eventually produce.
 */

import type { TaskType } from '@/lib/task/types';

export type SessionMode = 'practice' | 'graded';

export interface SessionTaskSummary {
  id: string;
  slug: string;
  title: string;
  /** 1..5 — weighs the task in a graded session's suggested grade (lib/grading/). */
  difficulty: number;
}

/** A session task as the student's room sees it: enough to apply the file-delivery sequencing rule (lib/task/prerequisite.ts). */
export interface JoinedSessionTask extends SessionTaskSummary {
  type: TaskType;
  topicId: string;
  fileDelivery: boolean;
}

/** What a student sees after entering a valid, still-open session code. */
export interface JoinedSession {
  id: string;
  mode: SessionMode;
  roster: string[];
  tasks: JoinedSessionTask[];
  hintsEnabled: boolean;
  timeLimitS: number | null;
}

/** What the workspace reports once a Check completes, for the attempts table. */
export interface AttemptInput {
  sessionId: string;
  studentName: string;
  taskId: string;
  taskVersion: number;
  submittedAnswer: Record<string, unknown>;
  passed: boolean;
  /** 0..1, see AttemptOutcome.score. */
  score?: number;
  hintsUsed: number;
  durationMs: number;
}
