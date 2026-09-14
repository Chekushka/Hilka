/**
 * The declarative check evaluator.
 *
 * Pure: same inputs, same answer, no I/O, no globals, no Python. A task passes
 * when every check passes. Anything a check needs and does not get — a run that
 * never happened, a reference that was not computed — fails that check rather
 * than passing it silently.
 */
import { isClosed, boundingBox, shapeContains, shapesMatch, totalLength } from './geometry';
import { fallbackMessage } from './messages';
import { extractNumbers, lastLine, normalizeText } from './text';
import type { Check, CheckReport, CheckResult, Evidence } from './types';

/** Kinds whose evaluators are not written yet. They never report a pass. */
const UNSUPPORTED: ReadonlySet<Check['kind']> = new Set([
  'var_equals',
  'expr',
  'uses',
  'forbids',
  'grid_goal'
]);

function within(value: number, tol: number, expected: number): boolean {
  return Math.abs(value - expected) <= tol;
}

function inRange(value: number, range: number | [number, number]): boolean {
  if (typeof range === 'number') {
    return value === range;
  }
  return value >= range[0] && value <= range[1];
}

function evaluateOne(check: Check, evidence: Evidence): boolean {
  const { submission, run, reference } = evidence;

  switch (check.kind) {
    case 'choice_equals': {
      const chosen = [...(submission.choiceIndices ?? [])].sort((a, b) => a - b);
      const expected = [...check.indices].sort((a, b) => a - b);
      return chosen.length === expected.length && chosen.every((v, i) => v === expected[i]);
    }

    case 'order_equals': {
      const lines = submission.orderedLines;
      if (!lines || lines.length !== check.lines.length) {
        return false;
      }
      return lines.every((line, i) => line.index === check.lines[i]);
    }

    case 'text_equals': {
      if (submission.text === undefined) {
        return false;
      }
      return (
        normalizeText(submission.text, check.normalize) ===
        normalizeText(check.value, check.normalize)
      );
    }

    case 'stdout_equals': {
      if (!run) return false;
      const trim = check.trim ?? true;
      return trim
        ? run.stdout.trim() === check.value.trim()
        : run.stdout === check.value;
    }

    case 'stdout_contains': {
      if (!run) return false;
      return check.ignoreCase
        ? run.stdout.toLowerCase().includes(check.value.toLowerCase())
        : run.stdout.includes(check.value);
    }

    case 'last_line_equals': {
      if (!run) return false;
      return (
        normalizeText(lastLine(run.stdout), check.normalize) ===
        normalizeText(check.value, check.normalize)
      );
    }

    case 'number_close': {
      if (!run) return false;
      const numbers = extractNumbers(run.stdout);
      if (numbers.length === 0) return false;
      const which = check.which ?? 'last';
      let found: number | undefined;
      if (which === 'last') {
        found = numbers[numbers.length - 1];
      } else if (which === 'first') {
        found = numbers[0];
      } else {
        found = numbers[which];
      }
      return found !== undefined && within(found, check.tol, check.value);
    }

    case 'numbers_equal': {
      if (!run) return false;
      const numbers = extractNumbers(run.stdout);
      return (
        numbers.length === check.values.length &&
        numbers.every((n, i) => within(n, check.tol, check.values[i]))
      );
    }

    case 'shape_equals': {
      // Expected geometry always comes from executing the author's reference
      // solution, never from a hand-written list of coordinates.
      if (!run || !reference?.drawing) return false;
      return shapesMatch(run.drawing, reference.drawing, {
        tolerance: check.tolerance,
        normalize: check.normalize
      });
    }

    case 'shape_contains': {
      if (!run) return false;
      return shapeContains(run.drawing, check.segments, check.tolerance);
    }

    case 'shape_props': {
      if (!run) return false;
      const drawing = run.drawing;
      if (check.closed !== undefined && isClosed(drawing) !== check.closed) {
        return false;
      }
      if (check.segmentCount !== undefined && !inRange(drawing.length, check.segmentCount)) {
        return false;
      }
      if (check.totalLength !== undefined) {
        const length = totalLength(drawing);
        if (length < check.totalLength[0] || length > check.totalLength[1]) {
          return false;
        }
      }
      if (check.bbox !== undefined) {
        const box = boundingBox(drawing);
        if (box.some((value, i) => Math.abs(value - check.bbox![i]) > 1)) {
          return false;
        }
      }
      if (check.colors !== undefined) {
        const used = new Set(drawing.map((s) => s.color));
        if (check.colors.some((color) => !used.has(color))) {
          return false;
        }
      }
      return true;
    }

    default:
      // var_equals, expr, uses, forbids, grid_goal — no evaluator yet.
      return false;
  }
}

export function evaluateCheck(check: Check, evidence: Evidence): CheckResult {
  const unsupported = UNSUPPORTED.has(check.kind);
  const passed = unsupported ? false : evaluateOne(check, evidence);
  return {
    check,
    passed,
    message: passed ? '' : check.message ?? fallbackMessage(check),
    ...(unsupported ? { unsupported: true } : {})
  };
}

/** A task passes when every check passes. */
export function evaluateChecks(checks: Check[], evidence: Evidence): CheckReport {
  const results = checks.map((check) => evaluateCheck(check, evidence));
  return { passed: results.every((r) => r.passed), results };
}
