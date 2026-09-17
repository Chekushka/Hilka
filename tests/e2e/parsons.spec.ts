import { expect, test, type Page } from '@playwright/test';

/**
 * A `parsons` task inside a session: assemble the lines using the add/remove
 * buttons alone (docs/TASK_SCHEMA.md's worked triangle example, seeded by
 * content/seed-tasks/grade7-parsons-triangle.json and picked up automatically
 * by the demo session — scripts/db/seed-demo-session.ts assigns every
 * published task). Drag reordering (@dnd-kit) is not exercised here — the
 * buttons are the same fully keyboard-accessible path a student without a
 * mouse would use, and nothing about Check depends on which path built the
 * order.
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Трикутник (склади програму)';

async function addLine(page: Page, text: string) {
  await page.locator('li', { hasText: text }).getByRole('button', { name: 'Додати ↓' }).click();
}

async function removeLine(page: Page, text: string) {
  await page.locator('li', { hasText: text }).getByRole('button', { name: 'Забрати ↑' }).click();
}

async function openTriangleTask(page: Page, name: string) {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByText('Розстав рядки так')).toBeVisible();
}

test('assembling the lines in the right order passes and records the attempt', async ({ page }) => {
  await openTriangleTask(page, 'Соломія');

  await addLine(page, 'import turtle');
  await addLine(page, 'for i in range(3):');
  await addLine(page, 'turtle.forward(100)');
  await addLine(page, 'turtle.right(120)');

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});

test('a distractor or a wrong order does not pass, but fixing it then does', async ({ page }) => {
  await openTriangleTask(page, 'Тарас');

  // The distractor instead of the real turn, plus the loop lines swapped.
  await addLine(page, 'turtle.forward(100)');
  await addLine(page, 'for i in range(3):');
  await addLine(page, 'import turtle');
  await addLine(page, 'turtle.right(90)');

  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();

  // Fix it: drop the distractor, re-add the real lines in order.
  await removeLine(page, 'turtle.right(90)');
  await removeLine(page, 'import turtle');
  await removeLine(page, 'for i in range(3):');
  await removeLine(page, 'turtle.forward(100)');

  await addLine(page, 'import turtle');
  await addLine(page, 'for i in range(3):');
  await addLine(page, 'turtle.forward(100)');
  await addLine(page, 'turtle.right(120)');

  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});
