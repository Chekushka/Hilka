import { expect, test, type Page } from '@playwright/test';

/**
 * A `predict` task inside a session: read the fixed snippet and type the
 * predicted output. Like quiz, nothing executes for the student — Check runs
 * the declarative evaluator directly, no runner involved — seeded by
 * content/seed-tasks/grade7-predict-arithmetic.json and picked up
 * automatically by the demo session (scripts/db/seed-demo-session.ts assigns
 * every published task).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Що виведе програма?';

async function openPredictTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByText('a = 2')).toBeVisible();
}

test('the correct prediction passes and records the attempt', async ({ page }) => {
  await openPredictTask(page, 'Олена');

  await page.getByLabel('Що виведе ця програма?').fill('14');

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});

test('a wrong prediction does not pass, but the right one after does', async ({ page }) => {
  await openPredictTask(page, 'Тарас');

  await page.getByLabel('Що виведе ця програма?').fill('20');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();

  await page.getByLabel('Що виведе ця програма?').fill('14');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});
