/**
 * The grading rules and the scale, as a student is shown them before a graded
 * session (docs/AI_CONTEXT.md, "Grading": students know what they get and for
 * what). Built from the grading config, never typed out separately, so the
 * text the student reads is the rule grade.ts applies — change a number in
 * config.ts and the explanation follows.
 *
 * Pure. Returns message keys under `grading.rules` with their values; the
 * room turns them into Ukrainian through messages/uk.json.
 */
import { DEFAULT_GRADING, type GradingConfig } from './config';
import { taskPoints } from './grade';
import type { SessionKind, SessionMode } from '@/lib/session/types';

export type TaskLevel = 'easy' | 'medium' | 'hard';

/**
 * How a task's difficulty reads to a student. Hard is exactly what opens the
 * high band (`highBandMinDifficulty`), so "solve a hard task" in the rules and
 * the mark in the task list are the same thing.
 */
export function taskLevel(difficulty: number, config: GradingConfig = DEFAULT_GRADING): TaskLevel {
  if (difficulty >= config.highBandMinDifficulty) return 'hard';
  return difficulty >= 3 ? 'medium' : 'easy';
}

/** `grading.points.<category>` for a number of points — Ukrainian has one/few/many forms. */
const plural = new Intl.PluralRules('uk');
export function pointsMessageKey(points: number): string {
  return `grading.points.${Number.isInteger(points) ? plural.select(points) : 'other'}`;
}

export type RuleKey =
  | 'firstCheckOnly'
  | 'runIsFree'
  | 'crashNotCounted'
  | 'points'
  | 'partialCases'
  | 'hints'
  | 'timeLimit'
  | 'homeworkFirstCheck'
  | 'homeworkFixes'
  | 'improvement'
  | 'classCheck'
  | 'highBand'
  | 'homeworkHighBand'
  | 'highBandUnavailable'
  | 'teacherDecides';

export interface Rule {
  key: RuleKey;
  /** Numbers as they are said; `points*` are point counts the room words with `pointsMessageKey`. */
  values?: Record<string, number>;
}

export interface RulesInput {
  kind: SessionKind;
  mode: SessionMode;
  hintsEnabled: boolean;
  timeLimitS: number | null;
  /** The difficulties of the tasks that count for this student (their pool, plus improvement tasks). */
  difficulties: number[];
  hasImprovementTasks: boolean;
}

const percent = (share: number) => Math.round(share * 100);

/**
 * What a session's grade is made of, in the order a student needs it: how
 * attempts work, what each task is worth, what lowers that, what the top band
 * asks for. Empty for a practice session, which grades nothing, and for a class
 * check, which has no grade of its own and says what it does in its own notice.
 */
export function sessionRules(input: RulesInput, config: GradingConfig = DEFAULT_GRADING): Rule[] {
  if (input.mode !== 'graded' || input.kind === 'check') return [];
  const homework = input.kind === 'homework';
  const rules: Rule[] = [];

  if (homework) {
    rules.push({ key: 'homeworkFirstCheck' });
    rules.push({ key: 'homeworkFixes', values: { n: config.maxFixes, credit: percent(config.fixCredit) } });
  } else {
    rules.push({ key: 'firstCheckOnly' });
  }
  rules.push({ key: 'runIsFree' });
  rules.push({ key: 'crashNotCounted' });
  rules.push({
    key: 'points',
    values: {
      pointsEasy: taskPoints(1, config),
      pointsMedium: taskPoints(3, config),
      pointsHard: taskPoints(config.highBandMinDifficulty, config)
    }
  });
  rules.push({ key: 'partialCases' });
  if (input.hintsEnabled) rules.push({ key: 'hints', values: { credit: percent(config.hintCredit) } });
  if (input.timeLimitS !== null) rules.push({ key: 'timeLimit', values: { minutes: Math.round(input.timeLimitS / 60) } });
  if (homework && input.hasImprovementTasks) rules.push({ key: 'improvement' });
  if (homework) rules.push({ key: 'classCheck', values: { credit: percent(config.fixCredit) } });

  const highBandOpen = input.difficulties.some((d) => d >= config.highBandMinDifficulty);
  if (highBandOpen) {
    rules.push({ key: homework ? 'homeworkHighBand' : 'highBand', values: { from: config.highBandCap + 1 } });
  } else if (input.difficulties.length > 0) {
    rules.push({ key: 'highBandUnavailable', values: { cap: config.highBandCap } });
  }
  rules.push({ key: 'teacherDecides' });
  return rules;
}

export type ScaleLevelKey = 'initial' | 'average' | 'sufficient' | 'high';

export interface ScaleRow {
  grade: number;
  /**
   * Share of points in percent, to one decimal (10/12 is 83.3, not a rounded
   * 83 that would misplace the boundary): above `from` (0 for grade 1: from
   * nothing), up to and including `to`.
   */
  from: number;
  to: number;
}

export interface ScaleLevel {
  level: ScaleLevelKey;
  rows: ScaleRow[];
}

const tenth = (share: number) => Math.round(share * 1000) / 10;

const LEVELS: ScaleLevelKey[] = ['initial', 'average', 'sufficient', 'high'];

/**
 * The 12-point scale as share-of-points ranges, grouped into its four levels
 * of three grades. From `upperBounds`, the same table `gradeForShare` reads.
 */
export function gradingScale(config: GradingConfig = DEFAULT_GRADING): ScaleLevel[] {
  const rows: ScaleRow[] = config.upperBounds.map((bound, index) => ({
    grade: index + 1,
    from: index === 0 ? 0 : tenth(config.upperBounds[index - 1]),
    to: Math.min(100, tenth(bound))
  }));
  return LEVELS.map((level, index) => ({ level, rows: rows.slice(index * 3, index * 3 + 3) }));
}
