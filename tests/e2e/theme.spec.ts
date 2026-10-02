import { expect, test } from '@playwright/test';

/**
 * The light/dark switch in the app bar (components/layout/ThemeToggle.tsx,
 * lib/theme.ts): the system decides until someone presses it, the choice wins
 * over the system either way, and it survives a reload.
 */

const DARK_BG = 'rgb(26, 32, 29)';
const LIGHT_BG = 'rgb(241, 243, 236)';

const background = (page: import('@playwright/test').Page) =>
  page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor);

test('a light system can switch to dark, and the choice survives a reload', async ({ browser }) => {
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto('/practice');
  expect(await background(page)).toBe(LIGHT_BG);

  await page.getByRole('button', { name: 'Увімкнути темну тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await background(page)).toBe(DARK_BG);

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await background(page)).toBe(DARK_BG);
  await expect(page.getByRole('button', { name: 'Увімкнути світлу тему' })).toBeVisible();
  await page.close();
});

test('a dark system can switch to light, on every screen with the app bar', async ({ browser }) => {
  const page = await browser.newPage({ colorScheme: 'dark' });
  await page.goto('/');
  expect(await background(page)).toBe(DARK_BG);

  await page.getByRole('button', { name: 'Увімкнути світлу тему' }).click();
  expect(await background(page)).toBe(LIGHT_BG);

  // The teacher side shares the bar, and the choice.
  await page.goto('/login');
  expect(await background(page)).toBe(LIGHT_BG);
  await expect(page.getByRole('button', { name: 'Увімкнути темну тему' })).toBeVisible();
  await page.close();
});
