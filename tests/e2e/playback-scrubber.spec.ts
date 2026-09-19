import { expect, test, type Page } from '@playwright/test';

/**
 * The turtle playback scrubber (grade 7 lesson 40, «покрокове виконання»).
 * `content/seed-tasks/grade7-turtle-square.json`'s reference draws a square
 * with exactly four `forward` + `right` pairs, so a passing run always
 * produces four segments — a stable step count to assert against.
 */

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
});

test('no scrubber controls before anything has been drawn', async ({ page }) => {
  await expect(page.getByRole('slider', { name: 'Перемотка малювання' })).toHaveCount(0);
});

test('a completed run shows the scrubber at the final step', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  const slider = page.getByRole('slider', { name: 'Перемотка малювання' });
  await expect(slider).toBeVisible();
  await expect(slider).toHaveValue('4');
  await expect(page.getByText('Крок 4 з 4')).toBeVisible();
});

test('the previous-step button rewinds one segment at a time', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByText('Крок 4 з 4')).toBeVisible({ timeout: 20_000 });

  await page.getByRole('button', { name: 'Попередній крок' }).click();
  await expect(page.getByText('Крок 3 з 4')).toBeVisible();

  // Stepping is call order, not source line — the same tight loop produces
  // four identical-looking steps, and the count is what proves it moved.
  await page.getByRole('button', { name: 'Наступний крок' }).click();
  await expect(page.getByText('Крок 4 з 4')).toBeVisible();
});

test('dragging the slider to the start hides the undrawn segments', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByText('Крок 4 з 4')).toBeVisible({ timeout: 20_000 });

  const slider = page.getByRole('slider', { name: 'Перемотка малювання' });
  await slider.fill('0');
  await expect(page.getByText('Крок 0 з 4')).toBeVisible();
  // Rewound to nothing drawn: only the translucent target outline remains.
  await expect(page.getByRole('button', { name: 'Попередній крок' })).toBeDisabled();
});

test('play steps through automatically and stops at the end', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByText('Крок 4 з 4')).toBeVisible({ timeout: 20_000 });

  const slider = page.getByRole('slider', { name: 'Перемотка малювання' });
  await slider.fill('0');
  await expect(page.getByText('Крок 0 з 4')).toBeVisible();

  await page.getByRole('button', { name: 'Відтворити крок за кроком' }).click();
  await expect(page.getByRole('button', { name: 'Пауза' })).toBeVisible();
  // Four segments at 400ms apart; generous margin for a slow CI runner.
  await expect(page.getByText('Крок 4 з 4')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'Відтворити крок за кроком' })).toBeVisible();
});
