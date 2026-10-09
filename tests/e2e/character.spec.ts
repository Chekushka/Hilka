import { expect, test } from '@playwright/test';

/**
 * The practice character (lib/meta/character.ts): XP adds up to levels, and
 * each level unlocks something to wear. Like XP, the level is derived from the
 * completed slugs in localStorage; the look the student picked is stored there too.
 */

const QUIZ = '/practice/g7-25-intro/g7-quiz-print-purpose';
// Difficulty 2, so 20 XP: one more 10 XP task reaches level 2 at 30 XP.
const TWENTY_XP = { completedTaskSlugs: ['g7-predict-print-sum-text'] };

/** Seeds local progress once per tab, so what the page writes later is not overwritten on the next navigation. */
function seedProgress(value: string) {
  if (!sessionStorage.getItem('seeded')) {
    localStorage.setItem('hilka:practice:progress', value);
    sessionStorage.setItem('seeded', '1');
  }
}

test('a pass that reaches a new level says so and names what it unlocked', async ({ page }) => {
  await page.addInitScript(seedProgress, JSON.stringify(TWENTY_XP));
  await page.goto('/practice');
  await expect(page.getByTestId('character-card').getByTestId('character-level')).toHaveText('Рівень 1 · Новачок');
  await expect(page.getByTestId('character-card')).toContainText('До рівня 2: ще 10 XP');

  await page.goto(QUIZ);
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByTestId('xp-earned')).toHaveText('+10 XP');
  const levelUp = page.getByTestId('level-up');
  await expect(levelUp).toContainText('Новий рівень: 2!');
  await expect(levelUp).toContainText('Відкрито: Небо, Кепка');

  await levelUp.getByRole('link', { name: /Вдягнути героя/ }).click();
  await expect(page).toHaveURL(/\/practice\/character$/);
  await expect(page.getByTestId('character-level')).toHaveText('Рівень 2 · Стартер');
});

test('an unlocked item can be worn and stays on; a locked one cannot be picked', async ({ page }) => {
  await page.addInitScript(
    seedProgress,
    JSON.stringify({ completedTaskSlugs: [...TWENTY_XP.completedTaskSlugs, 'g7-code-print-python'] })
  );
  await page.goto('/practice/character');
  await expect(page.getByTestId('character-level')).toHaveText('Рівень 2 · Стартер');

  const sky = page.locator('[data-item="body:sky"]');
  await expect(sky).toHaveAttribute('aria-pressed', 'false');
  await sky.click();
  await expect(sky).toHaveAttribute('aria-pressed', 'true');

  // Honey opens at level 4.
  const honey = page.locator('[data-item="body:honey"]');
  await expect(honey).toBeDisabled();
  await expect(honey).toHaveAccessibleName('Мед — відкриється на рівні 4');

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hilka:practice:progress') ?? '{}'));
  expect(stored.look).toEqual({ body: 'sky' });
  // Completed tasks are untouched by dressing up.
  expect(stored.completedTaskSlugs).toHaveLength(2);

  await page.goto('/practice');
  await expect(page.getByTestId('character-card').locator('svg[data-look]')).toHaveAttribute('data-look', 'sky dots sprout none');
});
