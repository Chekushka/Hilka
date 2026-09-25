/**
 * Default grading configuration (docs/AI_CONTEXT.md, "Grading"). Decided with
 * the teacher; kept as data rather than inlined in grade.ts because teachers
 * disagree about grading and a per-session override is planned.
 */

export interface GradingConfig {
  /** Points a task is worth, by its difficulty (1..5). */
  pointsByDifficulty: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Credit multiplier for a task solved after opening at least one hint. */
  hintCredit: number;
  /**
   * Upper bound (inclusive) of the share of points for grades 1..12, in
   * order. A share above `upperBounds[g - 2]` and at most `upperBounds[g - 1]`
   * is grade g.
   */
  upperBounds: readonly number[];
  /** Grades above `highBandCap` need a fully solved task at least this difficult. */
  highBandMinDifficulty: number;
  highBandCap: number;
}

/**
 * Levels of the Ukrainian 12-point scale, widened in the middle on purpose:
 * початковий up to 15%, середній to 60%, достатній to 75%, високий above.
 * Three grades per level, evenly spaced inside it.
 */
export const DEFAULT_GRADING: GradingConfig = {
  pointsByDifficulty: { 1: 1, 2: 1, 3: 2, 4: 3, 5: 3 },
  hintCredit: 0.75,
  upperBounds: [0.05, 0.1, 0.15, 0.3, 0.45, 0.6, 0.65, 0.7, 0.75, 10 / 12, 11 / 12, 1],
  highBandMinDifficulty: 4,
  highBandCap: 9
};
