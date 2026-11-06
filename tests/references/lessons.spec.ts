import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { checkGuessRuns, guessShapeProblems, isAnswerable, theoryGuesses, type GuessRun } from '@/lib/lessons/theory';
import type { RunResult } from '@/lib/runner';

/**
 * Every «Як думаєш?» card in content/lessons/ (lib/lessons/theory.ts), run
 * for real: the marked option must be what the code prints and no other
 * option may be (CLAUDE.md rule 5). The lesson form checks the same in the
 * teacher's browser before a save; this covers content that reaches the
 * database by the seed, and a runner upgrade that changes what code prints.
 */

const root = path.join(process.cwd(), 'content', 'lessons');
const files = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .flatMap((dir) =>
    readdirSync(path.join(root, dir.name))
      .filter((file) => file.endsWith('.md'))
      .map((file) => path.join(dir.name, file))
  )
  .sort();

test.beforeEach(async ({ page }) => {
  await page.goto('/runner');
  await page.waitForFunction(() => window.__runner__ !== undefined);
});

for (const file of files) {
  const markdown = readFileSync(path.join(root, file), 'utf8');
  const guesses = theoryGuesses(markdown);
  if (guesses.length === 0) continue;

  test(`${file}: every «Як думаєш?» answer is what its code prints`, async ({ page }) => {
    expect(guessShapeProblems(markdown)).toEqual([]);
    const runs: GuessRun[] = [];
    for (const guess of guesses.filter(isAnswerable)) {
      const result = (await page.evaluate(
        (source) => window.__runner__!.run(source, { mode: 'headless' }),
        guess.code
      )) as RunResult;
      runs.push({ code: guess.code, stdout: result.stdout, failed: Boolean(result.error) || result.timedOut });
    }
    expect(checkGuessRuns(markdown, runs)).toEqual([]);
  });
}

test('content/lessons/ has lessons that ask something', () => {
  // As in verify.spec.ts: an empty loop above must not pass quietly.
  expect(files.some((file) => theoryGuesses(readFileSync(path.join(root, file), 'utf8')).length > 0)).toBe(true);
});
