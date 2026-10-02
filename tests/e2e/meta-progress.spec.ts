import { expect, test } from '@playwright/test';

/**
 * XP and the garden (docs/TASKS.md, "Meta Layer"). Both are derived from
 * the completed task slugs in localStorage, so a fresh browser context starts
 * at zero. The reward shows on the lesson list and in the success result of a
 * task's first pass — never on the workspace itself.
 */

const QUIZ = '/practice/g7-25-intro/g7-quiz-print-purpose';

test('passing a task for the first time earns XP and grows its plant, shown on the success result and in the garden', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('0 XP');
  // The garden: one plant per topic, a seed until its first task is passed.
  const intro = page.getByTestId('garden').getByRole('link', { name: 'Середовище програмування' });
  await expect(intro).toHaveAttribute('data-stage', '0');
  await expect(intro).toContainText('0 з');
  // Each plant opens where its topic carries on — tapping a flower must lead somewhere.
  await expect(intro).toHaveAttribute('href', /^\/practice\/g7-25-intro\//);

  await page.goto(QUIZ);
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  // Difficulty 1 is worth 10 XP (lib/meta/progress.ts).
  await expect(page.getByTestId('xp-earned')).toHaveText('+10 XP');
  // The first solved task always sprouts its topic's plant (lib/meta/garden.ts).
  await expect(page.getByTestId('garden-growth')).toHaveText('Тема «Середовище програмування» у твоєму саду: паросток');

  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');
  await expect(intro).toHaveAttribute('data-stage', '1');
  await expect(intro).toContainText('1 з');
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
  await expect(page.getByTestId('garden-growth')).toHaveCount(0);

  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).toHaveText('10 XP');
});
