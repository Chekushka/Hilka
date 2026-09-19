import { expect, test, type Page } from '@playwright/test';

/**
 * A `fix` task inside a session: the editor starts pre-filled with
 * `payload.broken`, exactly like `code` starts from `payload.starter`
 * (FixTaskView reuses CodeTaskView's run/check flow via `useTaskRunner`'s
 * shared `RunnableTask` shape). Seeded by
 * content/seed-tasks/grade7-fix-square.json and picked up automatically by
 * the demo session (scripts/db/seed-demo-session.ts assigns every published
 * task).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Полагодь фігуру';

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function openFixTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
}

test('the editor starts from the broken code, which fails until fixed', async ({ page }) => {
  await openFixTask(page, 'Олена');

  // Unmodified broken code (right(80) instead of right(90)) must not pass.
  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});
