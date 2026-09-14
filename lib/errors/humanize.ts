/**
 * PyError → something a student can act on.
 *
 * Falls back to a calm generic message rather than ever surfacing a raw
 * traceback: an unrecognized error is our problem to fix, not the student's to
 * decipher.
 */
import { lineAt, lines } from './source';
import { RULES } from './rules';
import { recordUnmatched } from './unmatched';
import type { HumanError } from './types';
import type { PyError } from '@/lib/runner';

const FALLBACK = {
  title: 'Програма зупинилася',
  explanation: 'Python не зміг виконати цей рядок до кінця.',
  hint: 'Порівняй його з прикладом у завданні або попроси підказку.'
};

/**
 * A timeout is not an error in the student's eyes and must not be phrased as
 * one. The program did not finish; nobody did anything wrong.
 */
export function humanizeTimeout(): HumanError {
  return {
    title: 'Програма не завершилася',
    explanation: 'Вона виконувалась надто довго — схоже, цикл не має виходу.',
    hint: 'Перевір умову циклу while: чи змінюється те, від чого вона залежить?',
    line: null,
    ruleId: 'timeout'
  };
}

export function humanize(error: PyError, code: string): HumanError {
  const context = { code };
  for (const rule of RULES) {
    if (rule.type !== '*' && rule.type !== error.type) continue;
    if (!rule.matches(error, context)) continue;
    return {
      ...rule.build(error, context),
      ...locate(error, code),
      ruleId: rule.id
    };
  }
  recordUnmatched(error);
  return { ...FALLBACK, ...locate(error, code), ruleId: 'fallback' };
}

/**
 * Skulpt can report a line past the end of the program — an unclosed bracket is
 * detected at end of file — so the line is clamped to something that exists.
 */
function locate(error: PyError, code: string): { line: number | null; sourceLine?: string } {
  if (error.line === null) {
    return { line: null };
  }
  const total = lines(code).length;
  const line = Math.min(Math.max(error.line, 1), total);
  const sourceLine = lineAt(code, line)?.trim();
  return { line, sourceLine: sourceLine && sourceLine.length > 0 ? sourceLine : undefined };
}
