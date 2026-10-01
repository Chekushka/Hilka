import { expect, test } from '@playwright/test';

/**
 * Picking practice up on another device from the home page
 * (docs/AI_CONTEXT.md, "Progress Codes"): a code minted with some progress
 * is typed on the entry page, the progress merges into this device, and the
 * student lands on the lessons.
 */

test('a progress code typed on the home page restores progress and opens the lessons', async ({ page, request }) => {
  const minted = await request.post('/api/progress', {
    data: { state: { completedTaskSlugs: ['g7-code-print-python', 'g7-code-ascii-house'] } }
  });
  expect(minted.ok()).toBe(true);
  const { code } = (await minted.json()) as { code: string };

  await page.goto('/');
  const form = page.getByRole('region', { name: 'Самостійна практика' });
  // Typed as a student might: lower case, dash and all.
  await form.getByLabel(/Введи його/).fill(code.toLowerCase());
  await form.getByRole('button', { name: 'Продовжити' }).click();

  await expect(page).toHaveURL(/\/practice$/);
  const stored = await page.evaluate(() => localStorage.getItem('hilka:practice:progress'));
  expect(JSON.parse(stored ?? '{}').completedTaskSlugs).toEqual(
    expect.arrayContaining(['g7-code-print-python', 'g7-code-ascii-house'])
  );
});

test('a wrong progress code on the home page says so and stays put', async ({ page }) => {
  await page.goto('/');
  const form = page.getByRole('region', { name: 'Самостійна практика' });
  await form.getByLabel(/Введи його/).fill('ZZZZ-ZZZZ');
  await form.getByRole('button', { name: 'Продовжити' }).click();
  await expect(form.getByRole('alert')).toHaveText('Такого коду не знайдено. Перевір, чи правильно ти його ввів.');
  await expect(page).toHaveURL(/\/$/);
});

test('a sample in a task prompt keeps its spaces and is set in the code face', async ({ page }) => {
  await page.goto('/practice/g7-25-intro/g7-code-ascii-house');
  const sample = page.locator('pre').filter({ hasText: '/____\\' });
  await expect(sample).toBeVisible();
  expect(await sample.textContent()).toBe('  /\\\n /  \\\n/____\\\n|    |\n|____|');
  const font = await sample.evaluate((element) => getComputedStyle(element).fontFamily);
  expect(font).toMatch(/JetBrains Mono|monospace/);
  // The fence itself never shows.
  await expect(page.getByText('```')).toHaveCount(0);
});
