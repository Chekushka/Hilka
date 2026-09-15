import { expect, test, type Page } from '@playwright/test';

/**
 * Session join → pick a name → check a task → attempt recorded. The fixture
 * session (code TEST01) is created by `npm run db:create-session` before this
 * suite runs — see .github/workflows/ci.yml and docs/CI_CD.md.
 */

const SESSION_CODE = 'TEST01';
const STUDENT_NAME = 'Тестова Олена';

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('joining with an unknown code shows a calm message, not an error page', async ({ page }) => {
  await page.goto('/s/ZZZZZZ');
  await expect(page.getByRole('heading', { name: 'Сесію не знайдено' })).toBeVisible();
});

test('the code entry form navigates to the session', async ({ page }) => {
  await page.goto('/s');
  await page.getByLabel('Код сесії').fill(SESSION_CODE.toLowerCase());
  await page.getByRole('button', { name: 'Приєднатися' }).click();
  await expect(page).toHaveURL(new RegExp(`/s/${SESSION_CODE}$`, 'i'));
});

test('join by name, check a task, and the flow reaches the finished screen', async ({ page }) => {
  await page.goto(`/s/${SESSION_CODE}`);
  await page.getByRole('button', { name: STUDENT_NAME }).click();

  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText('Завдання 1 з 1')).toBeVisible();

  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  // A completed check — not just a pass — is what unlocks moving on; the
  // student is never blocked from advancing by a wrong answer.
  await page.getByRole('button', { name: 'Наступне завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Усі завдання виконано' })).toBeVisible();
});

test('the chosen name survives a reload — no re-prompt mid-session', async ({ page }) => {
  await page.goto(`/s/${SESSION_CODE}`);
  await page.getByRole('button', { name: STUDENT_NAME }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('button', { name: STUDENT_NAME })).toHaveCount(0);
});
