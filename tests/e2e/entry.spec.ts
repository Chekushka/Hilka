import { expect, test } from '@playwright/test';

/**
 * The entry page: the teacher's session code typed on the front page, and the
 * way back when it was mistyped. The DEMO01 session comes from
 * scripts/db/seed-demo-session.ts (.github/workflows/ci.yml).
 */

test('a code typed on the front page opens the session, however it was typed', async ({ page }) => {
  await page.goto('/');
  const field = page.getByLabel('Код заняття');
  const join = page.getByRole('button', { name: 'Увійти' });
  await expect(join).toBeDisabled();

  // Lower case, a stray space, and a Cyrillic «О» (U+041E) where the projector shows a Latin one.
  await field.fill('demО 01');
  await expect(field).toHaveValue('DEMO01');
  await join.click();

  await expect(page).toHaveURL(/\/s\/DEMO01$/);
  await expect(page.getByRole('heading', { name: "Обери своє ім'я" })).toBeVisible();
});

test('an unknown code offers the field again, not a dead end', async ({ page }) => {
  await page.goto('/s/zzzzzz');
  await expect(page.getByRole('heading', { name: 'Заняття не знайдено' })).toBeVisible();
  await page.getByLabel('Код заняття').fill('demo01');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('heading', { name: "Обери своє ім'я" })).toBeVisible();
});

test('the front page leads to the lessons and to the teacher login', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Відкрити уроки' }).click();
  await expect(page.getByRole('heading', { name: 'Уроки', level: 1 })).toBeVisible();

  await page.getByRole('link', { name: 'Hilka — на головну' }).click();
  await page.getByRole('link', { name: 'Для вчителя' }).click();
  // Not logged in: the dashboard sends the teacher to the login form.
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});
