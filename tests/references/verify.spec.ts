import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { checkTaskReference, type ReferenceCheckTask } from '@/lib/checker';
import type { ParseResult, RunOptions, RunResult } from '@/lib/runner';
import { lintFile } from '@/lib/task/file-lint';

/**
 * Re-runs every seed task's reference solution against its own checks — the
 * CLAUDE.md testing requirement, and what turns "a runner upgrade silently
 * broke forty tasks" into a red X instead of a dead lesson in March
 * (.github/workflows/reference-check.yml). Reads content/seed-tasks/*.json
 * directly, so it needs no database — the /runner dev page is enough to
 * drive the real Skulpt runner.
 */

const taskDir = path.join(process.cwd(), 'content', 'seed-tasks');
const files = readdirSync(taskDir)
  .filter((file) => file.endsWith('.json'))
  .sort();

test.beforeEach(async ({ page }) => {
  await page.goto('/runner');
  await page.waitForFunction(() => window.__runner__ !== undefined);
});

for (const file of files) {
  const task = JSON.parse(readFileSync(path.join(taskDir, file), 'utf8')) as ReferenceCheckTask;

  test(`${task.slug}: reference solution passes its own checks`, async ({ page }) => {
    const runPython = (code: string, options: RunOptions): Promise<RunResult> =>
      page.evaluate(
        ([source, mode, stdin, timeoutMs, randomSeed, exprs]) =>
          window.__runner__!.run(source, { mode, stdin, timeoutMs, randomSeed, exprs }),
        [
          code,
          'headless' as const,
          options.stdin,
          options.timeoutMs,
          options.randomSeed,
          options.exprs
        ] as const
      );

    const outcome = await checkTaskReference(task, runPython);
    expect(outcome.failures.map((f) => `[${f.context}] ${f.message}`)).toEqual([]);
  });

  const payload = task.payload as { delivery?: string; starter?: string; broken?: string };
  if (payload.delivery === 'file') {
    // A file task must not require what its own upload would reject
    // (docs/TASK_SCHEMA.md, "Safe subset"): the reference and the starting
    // code both have to get through step 9.
    test(`${task.slug}: reference and starting code pass the file-upload linter`, async ({ page }) => {
      for (const code of [task.reference?.code ?? '', payload.starter ?? payload.broken ?? '']) {
        const parsed = await page.evaluate((source) => window.__runner__!.parse(source), code) as ParseResult;
        expect(lintFile(parsed, code)).toEqual([]);
      }
    });
  }
}

test('seed-tasks directory is not silently empty', () => {
  // A check that always passes is worse than no check — this fails loudly if
  // content/seed-tasks/ is ever cleared, instead of the loop above quietly
  // running zero tests and CI staying green.
  expect(files.length).toBeGreaterThan(0);
});
