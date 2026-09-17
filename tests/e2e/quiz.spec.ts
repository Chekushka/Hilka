import { expect, test, type Page } from '@playwright/test';

/**
 * A `quiz` task inside a session: pick an option and Check judges it
 * instantly, no runner involved — seeded by
 * content/seed-tasks/grade7-quiz-variable-names.json and picked up
 * automatically by the demo session (scripts/db/seed-demo-session.ts
 * assigns every published task).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = "Правильне ім'я змінної";

async function openQuizTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.locator('p', { hasText: 'Яке з цих імен змінної' })).toBeVisible();
}

test('picking the correct option passes and records the attempt', async ({ page }) => {
  await openQuizTask(page, 'Олена');

  await page.getByLabel('x1', { exact: true }).check();

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});

test('a wrong option does not pass, but picking the right one after does', async ({ page }) => {
  await openQuizTask(page, 'Тарас');

  await page.getByLabel('1x', { exact: true }).check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();

  // A radio group: picking the correct one replaces the wrong selection.
  await page.getByLabel('x1', { exact: true }).check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});
