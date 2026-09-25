/**
 * Verifies that a reference solution actually passes its own checks —
 * CLAUDE.md rule 5's guarantee, checked mechanically instead of trusted.
 *
 * Pure: nothing here executes Python or imports lib/runner/ itself (CLAUDE.md
 * rule 3), only the RunResult shape, which lib/checker/types.ts already
 * depends on for Segment. `evaluateAgainstOwnRun` is the primitive both the
 * publish gate (a real run posted from the teacher's browser, evaluated
 * server-side in a route handler) and `checkTaskReference` (a live run driven
 * by Playwright, for CI) build on.
 */
import { evaluateChecks } from './evaluate';
import { normalizeText } from './text';
import type { Check, Evidence, Submission } from './types';
import type { RunOptions, RunResult } from '@/lib/runner';
import { enumerateParamCombinations, substituteParams, type ParamSpec } from '@/lib/seed';

export type RunPython = (code: string, options: RunOptions) => Promise<RunResult>;

/** What a caller already has after running some code — no worker, no Skulpt. */
export type RunOutcome = Pick<RunResult, 'stdout' | 'drawing' | 'error' | 'timedOut' | 'vars' | 'exprResults'>;

export interface CheckRunOutcome {
  /** False when `run` itself errored or timed out — no check was even judged. */
  ranCleanly: boolean;
  passed: boolean;
  /** Check failure messages. Empty when `!ranCleanly`. */
  failures: string[];
}

function exprsOf(checks: Check[]): string[] {
  return checks
    .filter((check): check is Check & { kind: 'expr' } => check.kind === 'expr')
    .map((check) => check.python);
}

/** Which of `checks` `run` fails, given `reference` as the target for shape_equals etc. */
export function evaluateRun(
  submission: Submission,
  checks: Check[],
  run: RunOutcome,
  reference: Evidence['reference']
): CheckRunOutcome {
  if (run.error || run.timedOut) {
    return { ranCleanly: false, passed: false, failures: [] };
  }
  const evidence: Evidence = {
    submission,
    run: {
      stdout: run.stdout,
      drawing: run.drawing,
      error: run.error,
      timedOut: run.timedOut,
      vars: run.vars,
      exprResults: run.exprResults
    },
    reference
  };
  const failures = evaluateChecks(checks, evidence)
    .results.filter((r) => !r.passed)
    .map((r) => r.message || `check "${r.check.kind}" failed`);
  return { ranCleanly: true, passed: failures.length === 0, failures };
}

/**
 * A reference solution's own run defines "expected": shape_equals compares
 * the run to itself here, trivially true. This still exercises every other
 * check kind — shape_props, number_close, uses — against the reference's
 * real output. This is the publish gate: a route handler calls it with a run
 * the teacher's browser already produced (no server-side Python — see
 * AI_CONTEXT.md, "Python Runner").
 */
export function evaluateAgainstOwnRun(code: string, checks: Check[], run: RunOutcome): CheckRunOutcome {
  return evaluateRun({ code }, checks, run, { stdout: run.stdout, drawing: run.drawing });
}

/**
 * `evaluateAgainstOwnRun` for an input-driven task: `taskChecks` plus each
 * case's own, against that case's own run — the publish-time equivalent of
 * `lib/task/use-task-runner.ts`'s `runChecks`, which does the same merge at
 * grading time. Shared by the publish route and the authoring editors, so
 * the editor's Publish button and the gate behind it cannot disagree. Any run
 * that did not finish cleanly makes the whole outcome `!ranCleanly`.
 */
export function evaluateCasesAgainstOwnRuns(
  code: string,
  taskChecks: Check[],
  cases: readonly { checks?: Check[] }[],
  caseRuns: readonly RunOutcome[]
): CheckRunOutcome {
  const failures: string[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    const outcome = evaluateAgainstOwnRun(code, [...taskChecks, ...(cases[i].checks ?? [])], caseRuns[i]);
    if (!outcome.ranCleanly) {
      return { ranCleanly: false, passed: false, failures: [] };
    }
    failures.push(...outcome.failures);
  }
  return { ranCleanly: true, passed: failures.length === 0, failures };
}

/**
 * `predict`'s equivalent of `evaluateAgainstOwnRun`: the fixed snippet in
 * `payload.code` IS the reference, and a perfect prediction is exactly its
 * real stdout — so checking that stdout as a `text` submission against the
 * task's own checks confirms whatever value the author typed into e.g.
 * `text_equals` actually matches what the code prints, instead of trusting
 * it by hand (CLAUDE.md rule 5).
 */
export function evaluatePredictionAgainstOwnRun(text: string, checks: Check[], run: RunOutcome): CheckRunOutcome {
  return evaluateRun({ text }, checks, run, { stdout: run.stdout, drawing: run.drawing });
}

/**
 * `predict`'s choice-mode equivalent: the author picks which of
 * `payload.options` the code prints via a single `choice_equals` check, but
 * nothing stops that index from being wrong by hand. This runs the code and
 * confirms the chosen option's own text actually equals the real stdout —
 * the same rule 5 guarantee `evaluatePredictionAgainstOwnRun` gives text
 * mode, applied to a chosen option instead of a typed string. Structural
 * problems (no check, more than one, an out-of-range index) are reported
 * here too rather than assumed already caught — `lib/task/predict.ts`'s
 * `validatePredictChoiceChecks` gives the same errors before anything runs,
 * but this function has no dependency on it (lib/checker/ never imports
 * lib/task/ — the dependency runs the other way).
 */
export function evaluatePredictionChoiceAgainstOwnRun(options: string[], checks: Check[], run: RunOutcome): CheckRunOutcome {
  if (run.error || run.timedOut) {
    return { ranCleanly: false, passed: false, failures: [] };
  }
  const choiceChecks = checks.filter((check): check is Check & { kind: 'choice_equals' } => check.kind === 'choice_equals');
  if (choiceChecks.length !== 1 || choiceChecks[0].indices.length !== 1) {
    return {
      ranCleanly: true,
      passed: false,
      failures: ['a choice-mode predict task needs exactly one choice_equals check naming exactly one index']
    };
  }
  const [index] = choiceChecks[0].indices;
  const chosenOption = options[index];
  if (chosenOption === undefined) {
    return { ranCleanly: true, passed: false, failures: [`choice_equals references option ${index}, but there is no such option`] };
  }
  const matches = normalizeText(chosenOption, 'trim') === normalizeText(run.stdout, 'trim');
  return {
    ranCleanly: true,
    passed: matches,
    failures: matches
      ? []
      : [`option "${chosenOption}" does not match the code's real output: "${run.stdout.trim()}"`]
  };
}

/** The subset of a task's shape this needs — mirrors validate.ts's TaskShape. */
export interface ReferenceCheckTask {
  slug: string;
  type: string;
  checks: Check[];
  cases?: { stdin: string[]; checks?: Check[]; label?: string }[] | null;
  reference?: { code: string } | null;
  payload?: { broken?: string; answerMode?: 'text' | 'choice'; options?: string[] };
  /** `code` only (docs/TASK_SCHEMA.md, "Parameterization") — every combination is checked, not just one seed. */
  params?: ParamSpec | null;
}

export interface ReferenceCheckFailure {
  /** The case label, or 'no cases' / 'broken' for the run it came from. */
  context: string;
  message: string;
}

export interface ReferenceCheckOutcome {
  slug: string;
  /** True when the task has no reference solution to run — nothing to verify. */
  skipped: boolean;
  passed: boolean;
  failures: ReferenceCheckFailure[];
}

/**
 * Runs `task.reference.code` — once per case, or once with no stdin when
 * there are none, and once per parameter combination when the task has
 * `params` (docs/TASK_SCHEMA.md, "Parameterization" — the whole point of
 * verifying every combination rather than a sampled seed) — and confirms
 * every check passes. For a `fix` task with a `broken` payload, also
 * confirms `broken` does NOT pass, per TASK_SCHEMA.md: a "broken" program
 * that passes is a bug in the task, not a strict solution.
 */
export async function checkTaskReference(
  task: ReferenceCheckTask,
  runPython: RunPython
): Promise<ReferenceCheckOutcome> {
  const referenceCode = task.reference?.code;
  if (!referenceCode) {
    return { slug: task.slug, skipped: true, passed: true, failures: [] };
  }

  const failures: ReferenceCheckFailure[] = [];
  const hasCases = (task.cases?.length ?? 0) > 0;
  const cases = hasCases ? task.cases! : [{ stdin: [], checks: [] as Check[] }];
  const combinations = task.params ? enumerateParamCombinations(task.params) : [{}];

  // The target for a broken payload's shape_equals etc. below: the correct
  // reference's own drawing/stdout from its first case (first combination,
  // for a parameterized task — fix and params are never combined today).
  let referenceArtifacts: Evidence['reference'] = null;

  for (const combo of combinations) {
    const comboCode = task.params ? substituteParams(referenceCode, combo) : referenceCode;
    const comboLabel = task.params ? ` (${JSON.stringify(combo)})` : '';

    for (const [i, runCase] of cases.entries()) {
      const context = (runCase.label ?? (hasCases ? `case ${i + 1}` : 'no cases')) + comboLabel;
      const checks = [...task.checks, ...(runCase.checks ?? [])];
      const stdin = task.params ? runCase.stdin.map((line) => substituteParams(line, combo)) : runCase.stdin;
      const result = await runPython(comboCode, {
        mode: 'headless',
        stdin,
        exprs: exprsOf(checks)
      });
      // `predict` has no code of its own to submit — a perfect prediction IS
      // the reference's real stdout (lib/task/types.ts). Choice mode compares
      // that stdout to the chosen option's text instead of a typed string.
      const outcome =
        task.type === 'predict'
          ? task.payload?.answerMode === 'choice'
            ? evaluatePredictionChoiceAgainstOwnRun(task.payload.options ?? [], checks, result)
            : evaluatePredictionAgainstOwnRun(result.stdout, checks, result)
          : evaluateAgainstOwnRun(comboCode, checks, result);
      if (!outcome.ranCleanly) {
        failures.push({
          context,
          message: result.error
            ? `reference solution raised ${result.error.type}: ${result.error.message}`
            : 'reference solution timed out'
        });
        continue;
      }
      if (referenceArtifacts === null) {
        referenceArtifacts = { stdout: result.stdout, drawing: result.drawing };
      }
      outcome.failures.forEach((message) => failures.push({ context, message }));
    }
  }

  if (task.type === 'fix' && task.payload?.broken) {
    const broken = task.payload.broken;
    const result = await runPython(broken, { mode: 'headless', exprs: exprsOf(task.checks) });
    // A broken program that raises or times out has correctly failed; only a
    // clean run that satisfies every check is the bug TASK_SCHEMA.md warns
    // about.
    const outcome = evaluateRun({ code: broken }, task.checks, result, referenceArtifacts);
    if (outcome.passed) {
      failures.push({
        context: 'broken',
        message: 'payload.broken passes every check — a "broken" program must fail'
      });
    }
  }

  return { slug: task.slug, skipped: false, passed: failures.length === 0, failures };
}
