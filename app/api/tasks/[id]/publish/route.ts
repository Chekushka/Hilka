/**
 * The publish gate (docs/TASK_SCHEMA.md, "Reference solutions"): a task's
 * reference solution must pass its own checks before it can go live.
 *
 * `code` — there is no server-side Python execution (docs/AI_CONTEXT.md), so
 * the reference run itself happens in the teacher's browser and is posted
 * here already computed. What this branch verifies server-side is the part
 * that IS pure and isomorphic: the checker evaluation
 * (lib/checker/reference-check.ts). It does not re-run Python, so it trusts
 * the run's own stdout/drawing/vars — an authenticated teacher is a trusted
 * author, not an adversarial student (CLAUDE.md, "Cheating and Trust").
 *
 * `parsons` — nothing executes, so there is no run to post: `payload.lines`
 * is already the correct order (lib/task/parsons.ts), and this branch checks
 * that order against the task's own checks entirely server-side, with an
 * empty request body.
 *
 * `quiz` — also nothing to run, and unlike `parsons` there is no canonical
 * submission either: the correct answer lives entirely in `checks`. This
 * branch instead confirms the checks are internally consistent with the
 * payload (lib/task/quiz.ts) — an index that exists, and exactly one when
 * the quiz is single-answer.
 *
 * `predict` — runs exactly like `code`: `payload.code` IS the reference,
 * there is no separate solution to write. The posted run's stdout stands in
 * for a perfect prediction. In text mode (`evaluatePredictionAgainstOwnRun`)
 * this confirms the checks the author wrote (e.g. `text_equals`) actually
 * match what the code prints; in choice mode
 * (`validatePredictChoiceChecks` + `evaluatePredictionChoiceAgainstOwnRun`)
 * it additionally confirms the `choice_equals` index is structurally sound
 * (exactly one, in range) and that the option it names is actually what the
 * code prints — instead of trusting a hand-typed value or a hand-picked
 * index either way.
 *
 * `fix` — like `code`, plus one extra proof: `payload.broken` (already
 * saved, read from `task` rather than re-trusted from the request body)
 * must NOT pass the very checks `reference.code` just did. A "broken"
 * program that already passes every check is a bug in the task
 * (TASK_SCHEMA.md, "Reference solutions"), so this needs both runs posted.
 *
 * `fill` — falls into the same generic branch as `code`: a separately
 * written reference (unrelated to `payload.template`'s gap structure, same
 * as `code`'s starter vs reference) must pass every check. Nothing about
 * `fill` needs special-casing here at all.
 *
 * `cases` (`code`/`fix` only) — when the task has any, `body.run` is still
 * required (it seeds `reference.artifacts`, same as always — the first
 * case's run), but `body.caseRuns` must also be posted: one run per case, in
 * `task.cases` order, each already executed against that case's own stdin
 * in the teacher's browser (`DraftTaskEditor`/`FixDraftEditor`). This mirrors
 * `lib/checker/reference-check.ts`'s `checkTaskReference` (used by
 * `npm run verify:references`), except against browser-computed runs instead
 * of a live Python process, for the same reason the no-cases path already
 * does that (no server-side Python — AI_CONTEXT.md).
 */
import { NextResponse } from 'next/server';
import { getCurrentTeacher } from '@/lib/auth/current-teacher';
import {
  evaluateAgainstOwnRun,
  evaluateChecks,
  evaluatePredictionAgainstOwnRun,
  evaluatePredictionChoiceAgainstOwnRun,
  evaluateRun,
  type Check,
  type RunOutcome
} from '@/lib/checker';
import { getTaskForAuthoring, publishTask } from '@/lib/db/task-authoring';
import { parsonsCanonicalSubmission } from '@/lib/task/parsons';
import { validatePredictChoiceChecks } from '@/lib/task/predict';
import { validateQuizChecks } from '@/lib/task/quiz';
import type { RunCase } from '@/lib/task/types';

interface PublishBody {
  referenceCode: string;
  run: RunOutcome;
  /** Present only when the task has `cases`; one run per case, same order. */
  caseRuns?: RunOutcome[];
}

interface FixPublishBody extends PublishBody {
  brokenRun: RunOutcome;
}

function isRunOutcomeShaped(value: unknown): value is RunOutcome {
  if (typeof value !== 'object' || value === null) return false;
  const run = value as Record<string, unknown>;
  return (
    typeof run.stdout === 'string' &&
    Array.isArray(run.drawing) &&
    typeof run.timedOut === 'boolean' &&
    (run.error === null || typeof run.error === 'object')
  );
}

function isValidBody(body: unknown): body is PublishBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.referenceCode === 'string' &&
    b.referenceCode.length > 0 &&
    isRunOutcomeShaped(b.run) &&
    (b.caseRuns === undefined || (Array.isArray(b.caseRuns) && b.caseRuns.every(isRunOutcomeShaped)))
  );
}

function isValidFixBody(body: unknown): body is FixPublishBody {
  if (typeof body !== 'object' || body === null) return false;
  const brokenRun = (body as Record<string, unknown>).brokenRun;
  return isValidBody(body) && isRunOutcomeShaped(brokenRun);
}

type CaseValidation =
  | { ok: true }
  | { ok: false; kind: 'reference_run_failed'; detail: unknown }
  | { ok: false; kind: 'reference_fails_checks'; failures: string[] };

/**
 * `task.checks` plus each case's own, evaluated against that case's own
 * already-computed run — the publish-time equivalent of
 * `lib/task/use-task-runner.ts`'s `runChecks`, which does the same merge at
 * grading time. Every case must pass; the first one that doesn't even run
 * cleanly stops the check there, same as a single-run task's own failure.
 */
function validateCases(referenceCode: string, taskChecks: Check[], cases: RunCase[], caseRuns: RunOutcome[]): CaseValidation {
  const failures: string[] = [];
  for (let i = 0; i < cases.length; i += 1) {
    const checks = [...taskChecks, ...(cases[i].checks ?? [])];
    const outcome = evaluateAgainstOwnRun(referenceCode, checks, caseRuns[i]);
    if (!outcome.ranCleanly) {
      return { ok: false, kind: 'reference_run_failed', detail: caseRuns[i].error };
    }
    failures.push(...outcome.failures);
  }
  return failures.length > 0 ? { ok: false, kind: 'reference_fails_checks', failures } : { ok: true };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const teacher = await getCurrentTeacher();
  if (!teacher) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const task = await getTaskForAuthoring(id);
  if (!task) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (task.status !== 'draft') {
    return NextResponse.json({ error: 'not_a_draft' }, { status: 409 });
  }

  if (task.type === 'parsons' && task.payload?.type === 'parsons') {
    const outcome = evaluateChecks(task.checks, { submission: parsonsCanonicalSubmission(task.payload) });
    if (!outcome.passed) {
      return NextResponse.json(
        {
          error: 'reference_fails_checks',
          failures: outcome.results.filter((r) => !r.passed).map((r) => r.message)
        },
        { status: 422 }
      );
    }
    const updated = await publishTask(id, null);
    if (!updated) {
      return NextResponse.json({ error: 'publish_race' }, { status: 409 });
    }
    return NextResponse.json(updated);
  }

  if (task.type === 'quiz' && task.payload?.type === 'quiz') {
    const errors = validateQuizChecks(task.payload, task.checks);
    if (errors.length > 0) {
      return NextResponse.json({ error: 'reference_fails_checks', failures: errors }, { status: 422 });
    }
    const updated = await publishTask(id, null);
    if (!updated) {
      return NextResponse.json({ error: 'publish_race' }, { status: 409 });
    }
    return NextResponse.json(updated);
  }

  if (task.type === 'fix' && task.payload?.type === 'fix') {
    const body: unknown = await request.json().catch(() => null);
    if (!isValidFixBody(body)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    if (task.cases && task.cases.length > 0) {
      if (!body.caseRuns || body.caseRuns.length !== task.cases.length) {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
      }
      const outcome = validateCases(body.referenceCode, task.checks, task.cases, body.caseRuns);
      if (!outcome.ok) {
        return NextResponse.json(
          outcome.kind === 'reference_run_failed'
            ? { error: outcome.kind, detail: outcome.detail }
            : { error: outcome.kind, failures: outcome.failures },
          { status: 422 }
        );
      }
    } else {
      const outcome = evaluateAgainstOwnRun(body.referenceCode, task.checks, body.run);
      if (!outcome.ranCleanly) {
        return NextResponse.json({ error: 'reference_run_failed', detail: body.run.error }, { status: 422 });
      }
      if (!outcome.passed) {
        return NextResponse.json({ error: 'reference_fails_checks', failures: outcome.failures }, { status: 422 });
      }
    }

    // The broken-code proof is unaffected by cases — it always runs once,
    // with no stdin, against the task-level checks only, exactly like
    // lib/checker/reference-check.ts's checkTaskReference does.
    const brokenOutcome = evaluateRun({ code: task.payload.broken }, task.checks, body.brokenRun, {
      stdout: body.run.stdout,
      drawing: body.run.drawing
    });
    if (brokenOutcome.passed) {
      return NextResponse.json({ error: 'broken_passes_checks' }, { status: 422 });
    }

    const updated = await publishTask(id, {
      code: body.referenceCode,
      computedAt: new Date().toISOString(),
      artifacts: { stdout: body.run.stdout, drawing: body.run.drawing }
    });
    if (!updated) {
      return NextResponse.json({ error: 'publish_race' }, { status: 409 });
    }
    return NextResponse.json(updated);
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isValidBody(body)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (task.type === 'predict' && task.payload?.type === 'predict' && task.payload.answerMode === 'choice') {
    const structuralErrors = validatePredictChoiceChecks(task.payload, task.checks);
    if (structuralErrors.length > 0) {
      return NextResponse.json({ error: 'reference_fails_checks', failures: structuralErrors }, { status: 422 });
    }
  }

  // Only `code` ever has cases here — `predict`'s payload.code and `fill`'s
  // template have no stdin story of their own.
  if (task.type === 'code' && task.cases && task.cases.length > 0) {
    if (!body.caseRuns || body.caseRuns.length !== task.cases.length) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    const outcome = validateCases(body.referenceCode, task.checks, task.cases, body.caseRuns);
    if (!outcome.ok) {
      return NextResponse.json(
        outcome.kind === 'reference_run_failed'
          ? { error: outcome.kind, detail: outcome.detail }
          : { error: outcome.kind, failures: outcome.failures },
        { status: 422 }
      );
    }
  } else {
    const outcome =
      task.type === 'predict' && task.payload?.type === 'predict'
        ? task.payload.answerMode === 'choice'
          ? evaluatePredictionChoiceAgainstOwnRun(task.payload.options ?? [], task.checks, body.run)
          : evaluatePredictionAgainstOwnRun(body.run.stdout, task.checks, body.run)
        : evaluateAgainstOwnRun(body.referenceCode, task.checks, body.run);
    if (!outcome.ranCleanly) {
      return NextResponse.json({ error: 'reference_run_failed', detail: body.run.error }, { status: 422 });
    }
    if (!outcome.passed) {
      return NextResponse.json({ error: 'reference_fails_checks', failures: outcome.failures }, { status: 422 });
    }
  }

  const updated = await publishTask(id, {
    code: body.referenceCode,
    computedAt: new Date().toISOString(),
    artifacts: { stdout: body.run.stdout, drawing: body.run.drawing }
  });
  if (!updated) {
    return NextResponse.json({ error: 'publish_race' }, { status: 409 });
  }
  return NextResponse.json(updated);
}
