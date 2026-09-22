/**
 * The database schema, as specified in docs/AI_CONTEXT.md.
 *
 * Two things here are load-bearing and easy to erode:
 * `classes.roster` is a plain array of display names and must never become a
 * students table — the no-registration constraint depends on it staying
 * trivial — and `attempts` is append-only, so a retry is a new row and "best
 * attempt" is a query.
 *
 * Deviation from the doc, deliberate: `tasks.slug`. Task content lives in
 * git as JSON (content/seed-tasks/) and is imported into the database, so it
 * needs a stable human-readable key that survives a re-import into a fresh
 * database. `topics` already has one for the same reason. Rows are still
 * identified by uuid everywhere else, foreign keys included.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  bigint,
  char,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';
import type { Check } from '@/lib/checker';
import type { PracticeProgress } from '@/lib/practice/progress';
import type { ParamSpec } from '@/lib/seed';
import type { Reference, RunCase, TaskPayload, TaskStatus, TaskType } from '@/lib/task/types';

export const topics = pgTable('topics', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  order: integer('order').notNull(),
  gradeTags: integer('grade_tags').array().notNull().default([]),
  curriculumRef: text('curriculum_ref'),
  theoryMd: text('theory_md')
});

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    topicId: uuid('topic_id')
      .notNull()
      .references(() => topics.id),
    type: text('type').$type<TaskType>().notNull(),
    title: text('title').notNull(),
    payload: jsonb('payload').$type<TaskPayload>().notNull(),
    checks: jsonb('checks').$type<Check[]>().notNull(),
    // Input-driven tasks only: one run per case. Null means a single run with
    // no stdin.
    cases: jsonb('cases').$type<RunCase[]>(),
    // { code, computedAt, artifacts } — artifacts are derived by executing the
    // author's reference solution on publish, never hand-written.
    reference: jsonb('reference').$type<Reference>(),
    hints: jsonb('hints').$type<string[]>().notNull().default([]),
    params: jsonb('params').$type<ParamSpec>(),
    difficulty: smallint('difficulty').notNull(),
    gradeTags: integer('grade_tags').array().notNull().default([]),
    // Bumped on publish, never on save: that is what makes it safe to edit a
    // task while a class is working on it.
    version: integer('version').notNull().default(1),
    status: text('status').$type<TaskStatus>().notNull().default('draft')
  },
  (table) => [index('tasks_topic_idx').on(table.topicId, table.difficulty)]
);

export const teachers = pgTable('teachers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  role: text('role').$type<'teacher' | 'admin'>().notNull().default('teacher'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * Magic-link login tokens (docs/AI_CONTEXT.md, "Teacher Auth"). Stored
 * hashed, never raw — a database leak must not hand out a working login
 * link — and single-use via `usedAt`. No session table alongside this: the
 * logged-in state itself lives in a signed cookie, not the database.
 */
export const teacherLoginTokens = pgTable('teacher_login_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id')
    .notNull()
    .references(() => teachers.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const classes = pgTable('classes', {
  id: uuid('id').primaryKey().defaultRandom(),
  teacherId: uuid('teacher_id')
    .notNull()
    .references(() => teachers.id),
  title: text('title').notNull(),
  // Display names the teacher typed. Not students, not accounts, nothing else.
  roster: text('roster').array().notNull().default([])
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    classId: uuid('class_id')
      .notNull()
      .references(() => classes.id),
    code: char('code', { length: 6 }).notNull(),
    mode: text('mode').$type<'practice' | 'graded'>().notNull(),
    taskIds: uuid('task_ids').array().notNull().default([]),
    timeLimitS: integer('time_limit_s'),
    hintsEnabled: boolean('hints_enabled').notNull().default(true),
    shuffle: boolean('shuffle').notNull().default(false),
    opensAt: timestamp('opens_at', { withTimezone: true }),
    closesAt: timestamp('closes_at', { withTimezone: true })
  },
  (table) => [
    // Codes are recycled: a code is unique only among sessions that are still
    // open, so today's ABC123 can be reused next month.
    uniqueIndex('sessions_open_code_idx')
      .on(table.code)
      .where(sql`${table.closesAt} is null`)
  ]
);

export const progressCodes = pgTable('progress_codes', {
  // Human-readable alphabet, no 0/O/1/I/l. A bearer credential for someone
  // else's practice progress, which is why entry is rate-limited.
  code: char('code', { length: 8 }).primaryKey(),
  state: jsonb('state').$type<PracticeProgress>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  // Exists so abandoned rows can be pruned later. Nothing prunes them yet.
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow()
});

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => sessions.id),
    studentName: text('student_name').notNull(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => tasks.id),
    // An attempt records the version it was made against, never just the id.
    taskVersion: integer('task_version').notNull(),
    seed: bigint('seed', { mode: 'bigint' }),
    submittedAnswer: jsonb('submitted_answer').$type<Record<string, unknown>>(),
    passed: boolean('passed').notNull(),
    score: numeric('score'),
    hintsUsed: integer('hints_used').notNull().default(0),
    durationMs: integer('duration_ms'),
    // { pasted, edits, tooFast } — the teacher sees a flag and decides. The
    // system never accuses anyone.
    flags: jsonb('flags').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index('attempts_session_idx').on(table.sessionId, table.studentName)]
);

/**
 * `lib/errors/`'s highest-value growth signal: a `PyError` no rule matched,
 * so the humanizer fell back to its calm generic message instead of a real
 * explanation (docs/AI_CONTEXT.md, "Error Humanization"). No student, session
 * or task reference on purpose — this is telemetry to grow the rule base
 * from, not an attempt record, and CLAUDE.md rule 8 rules out anything that
 * could identify who hit it.
 */
export const unmatchedErrors = pgTable('unmatched_errors', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Skulpt's exception type name and its own message text — see PyError.
  type: text('type').notNull(),
  message: text('message').notNull(),
  // The client's Date.now() when lib/errors/ first saw it.
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
