import { expect, test } from '@playwright/test';

/**
 * The topic map (components/meta/TopicMap.tsx): a grade's topics with their
 * progress from localStorage, the first unfinished one marked as the place to
 * carry on and leading straight to its next task.
 */

const INTRO_TASKS = [
  'g7-code-print-python',
  'g7-quiz-print-purpose',
  'g7-code-two-lines',
  'g7-predict-print-sum-text'
];

test('with nothing done, the first topic is where to carry on', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('link', { name: 'Карта тем' }).click();
  await expect(page.getByRole('heading', { name: 'Карта тем', level: 1 })).toBeVisible();
  const current = page.locator('#topic-current');
  await expect(current).toContainText('Середовище програмування');
  await expect(current).toContainText('продовжуй тут');

  await current.click();
  await expect(page).toHaveURL(/\/practice\/g7-25-intro\/g7-code-print-python$/);
});

test('a finished task moves the topic on, and its link skips what is done', async ({ page }) => {
  await page.addInitScript(
    (slugs) => localStorage.setItem('hilka:practice:progress', JSON.stringify({ completedTaskSlugs: slugs })),
    INTRO_TASKS.slice(0, 1)
  );
  await page.goto('/practice/map');
  const current = page.locator('#topic-current');
  await expect(current).toContainText('Середовище програмування');
  await expect(current).toContainText('1 з');
  await expect(current).toHaveAttribute('href', '/practice/g7-25-intro/g7-quiz-print-purpose');
});
