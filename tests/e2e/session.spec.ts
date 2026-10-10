import { expect, test, type Page } from '@playwright/test';

/**
 * Join by code → pick a name → run a task → the attempt lands in `attempts`.
 * The session comes from scripts/db/seed-demo-session.ts, run in CI alongside
 * scripts/db/seed-content.ts (.github/workflows/ci.yml).
 */

const DEMO_CODE = 'demo01'; // lower case: the route normalizes, a projector code is typed however it lands
// The square's row in the room: its title, then — since the room restores a student's
// attempts — maybe its mark from an earlier spec in this run. Other titles contain «Квадрат».
const SQUARE_ROW = /^Квадрат(\s?Виконано)?$/;

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('an unknown code gets a calm message, not an English error page', async ({ page }) => {
  await page.goto('/s/zzzzzz');
  await expect(page.getByRole('heading', { name: 'Заняття не знайдено' })).toBeVisible();
});

test('join, run the assigned task, and record the attempt', async ({ page }) => {
  await page.goto(`/s/${DEMO_CODE}`);
  await expect(page.getByRole('heading', { name: "Обери своє ім'я" })).toBeVisible();

  await page.getByRole('button', { name: 'Олена' }).click();
  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();

  await page.getByRole('button', { name: SQUARE_ROW }).click();
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });

  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Здати' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  // The task list remembers the pass — read back from the server, so a reload keeps it too.
  await page.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await expect(page.getByRole('button', { name: SQUARE_ROW })).toContainText('Виконано');

  // A reload keeps the chosen name (sessionStorage) and skips straight to the list.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  await expect(page.getByRole('button', { name: SQUARE_ROW })).toContainText('Виконано');
});
