/**
 * The session join contract: what the join screen and the session runner see,
 * and what the session builder (components/authoring/SessionBuilderForm.tsx)
 * produces.
 */

import type { TaskType } from '@/lib/task/types';

export type SessionMode = 'practice' | 'graded';

/**
 * A lesson in class, homework over several days, or a class check of a
 * homework — a short graded session in class that confirms the homework was
 * the student's own (docs/HOMEWORK.md, section 4a).
 */
export type SessionKind = 'lesson' | 'homework' | 'check';

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
  kind: SessionKind;
  roster: string[];
  tasks: JoinedSessionTask[];
  /** Homework only: offered once a point is lost (lib/homework/rules.ts). */
  improvementTasks: JoinedSessionTask[];
  hintsEnabled: boolean;
  timeLimitS: number | null;
  /** Homework only, ISO. Late work is still accepted, for less (lib/homework/rules.ts, `lateCredit`). */
  dueAt: string | null;
}

/** One of the student's own attempts, as the room reads them back (`GET /api/sessions/[code]/me`). */
export interface OwnAttempt {
  taskId: string;
  passed: boolean;
  score: number | null;
  hintsUsed: number;
  createdAt: string;
}

/** What the room restores on entry, on any device, any day. */
export interface OwnSessionState {
  /** Not voided, oldest first. */
  attempts: OwnAttempt[];
  /** Someone worked under this name from another browser (lib/homework/devices.ts). */
  usedElsewhere: boolean;
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
