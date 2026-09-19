import { expect, test, type Page } from '@playwright/test';

/**
 * A `fill` task inside a session: the template renders with an inline input
 * at every `{{n}}` gap (FillTaskView), and Check substitutes the answers
 * into a `code` string that runs exactly like `code`/`fix` already do
 * (`useTaskRunner`'s shared `RunnableTask` shape). Seeded by
 * content/seed-tasks/grade7-fill-pentagon.json and picked up automatically
 * by the demo session (scripts/db/seed-demo-session.ts assigns every
 * published task).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = "Заповни пропуски: п'ятикутник";

async function fillGap(page: Page, n: number, value: string) {
  const input = page.getByLabel(`Пропуск ${n}`, { exact: true });
  await input.fill(value);
}

async function openFillTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
}

test('wrong gap values fail, and the correct ones then pass', async ({ page }) => {
  await openFillTask(page, 'Олена');

  await fillGap(page, 1, '4');
  await fillGap(page, 2, '80');
  await fillGap(page, 3, '90');

  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  await fillGap(page, 1, '5');
  await fillGap(page, 3, '72');

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});
