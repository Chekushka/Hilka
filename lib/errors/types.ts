/**
 * A Python error, rewritten for a twelve-year-old who did not choose to be here.
 *
 * This layer is the highest-value part of the product for the target audience
 * and the one that decays silently: every unmatched error that reaches a
 * student as raw text is a dropout risk.
 */
import type { PyError } from '@/lib/runner';

export interface HumanError {
  /** What happened. Never the word "Error", never a verdict. */
  title: string;
  /** Why, in plain Ukrainian. */
  explanation: string;
  /** What to do next. Absent when there is nothing honest to suggest. */
  hint?: string;
  line: number | null;
  /** The student's own line, shown inline so the message points at something. */
  sourceLine?: string;
  /** Which rule fired, for logging and for tests. 'fallback' means none did. */
  ruleId: string;
}

export interface ErrorContext {
  /** The code the student ran, so a rule can look at the line that failed. */
  code: string;
}

export interface Rule {
  id: string;
  /** Skulpt's type name, or '*' to consider every error. */
  type: string | '*';
  matches(error: PyError, context: ErrorContext): boolean;
  build(error: PyError, context: ErrorContext): Omit<HumanError, 'line' | 'sourceLine' | 'ruleId'>;
}
