/**
 * The session join contract: what the join screen and the session runner see.
 * The teacher side (session builder, docs/TASKS.md) does not exist yet, so
 * sessions are created directly in the database for now; this is the shape a
 * builder UI will eventually produce.
 */

export type SessionMode = 'practice' | 'graded';

export interface SessionTaskSummary {
  id: string;
  slug: string;
  title: string;
}

/** What a student sees after entering a valid, still-open session code. */
export interface JoinedSession {
  id: string;
  mode: SessionMode;
  roster: string[];
  tasks: SessionTaskSummary[];
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
  hintsUsed: number;
  durationMs: number;
}
