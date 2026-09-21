import { expect, test, type Page } from '@playwright/test';

/**
 * A `code` task with `cases` (docs/TASK_SCHEMA.md, "Run cases"): the reference
 * warms up against the first case's stdin, and Check runs the student's code
 * once per case, merging every case's checks into one report
 * (lib/task/use-task-runner.ts's `runChecks`). Seeded by
 * content/seed-tasks/grade7-code-rectangle-perimeter.json — a hidden second
 * case exists specifically to fail a solution hardcoded to the visible one,
 * which is the whole reason cases exist (TASK_SCHEMA.md).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Периметр прямокутника';

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function openTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
}

test('a solution that works for every case passes', async ({ page }) => {
  await openTask(page, 'Олена');
  await typeSolution(page, 'a = float(input())\nb = float(input())\nprint(2 * (a + b))');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});

test('a solution hardcoded to the visible case fails on the hidden one', async ({ page }) => {
  await openTask(page, 'Тарас');
  // Passes the visible case (5, 3 -> 16) by printing a constant, ignoring
  // input entirely — exactly what the hidden case (10, 4 -> 28) exists to
  // catch.
  await typeSolution(page, 'input()\ninput()\nprint(16)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });
  // The failing case's own label names it, proving both cases actually ran.
  await expect(page.getByText('більший прямокутник', { exact: false })).toBeVisible();
});
