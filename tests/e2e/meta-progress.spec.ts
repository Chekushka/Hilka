import { expect, test } from '@playwright/test';

/**
 * XP and topic progress (docs/TASKS.md, "Meta Layer"). Both are derived from
 * the completed task slugs in localStorage, so a fresh browser context starts
 * at zero. The reward shows on the lesson list and in the success result of a
 * task's first pass — never on the workspace itself.
 */

const QUIZ = '/practice/g7-25-intro/g7-quiz-print-purpose';

test('passing a task for the first time earns XP, shown on the success result and the lesson list', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('0 XP');
  const intro = page.getByRole('progressbar', { name: 'Середовище програмування' });
  await expect(intro).toHaveAttribute('aria-valuenow', '0');

  await page.goto(QUIZ);
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  // Difficulty 1 is worth 10 XP (lib/meta/progress.ts).
  await expect(page.getByTestId('xp-earned')).toHaveText('+10 XP');

  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');
  await expect(intro).toHaveAttribute('aria-valuenow', '1');
});

test('passing an already completed task again earns nothing new', async ({ page }) => {
  await page.goto(QUIZ);
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByTestId('xp-earned')).toHaveText('+10 XP');

  await page.reload();
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await expect(page.getByTestId('xp-earned')).toHaveCount(0);

  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');
});
