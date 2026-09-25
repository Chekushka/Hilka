import { expect, test, type Page } from '@playwright/test';

/**
 * Session builder (docs/TASKS.md, "Session builder"): a teacher picks a
 * class, filters the published task catalog, assigns tasks, and gets back a
 * join code a student can actually use — end to end, not just the form.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

test('a teacher builds a session, and a student can join it', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await expect(page.getByRole('heading', { name: 'Нове заняття' })).toBeVisible();

  // Filtering by topic narrows the checklist to that topic's tasks — other
  // e2e specs publish their own tasks into the same shared database, so this
  // picks the seed square specifically rather than assuming it is the only
  // (or the first) item in the list.
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Черепашача графіка' });
  const squareItem = page.getByRole('listitem').filter({ hasText: 'Квадрат' });
  await expect(squareItem).toBeVisible();
  await squareItem.getByRole('checkbox').check();
  await expect(page.getByText('обрано: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });

  const codeText = page.locator('p.font-mono.text-2xl');
  const code = ((await codeText.textContent()) ?? '').trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await page.getByRole('link', { name: 'Переглянути заняття' }).click();
  await expect(page.getByRole('heading', { name: `Заняття ${code}` })).toBeVisible();
  await expect(page.getByText('Спроб ще немає.')).toBeVisible();

  // The code the builder minted actually joins, with only the one assigned task.
  await page.goto(`/s/${code.toLowerCase()}`);
  await expect(page.getByRole('button', { name: 'Олена' })).toBeVisible();
  await page.getByRole('button', { name: 'Олена' }).click();
  await expect(page.getByRole('button', { name: 'Квадрат' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Трикутник' })).toHaveCount(0);
});

test('creating a session with no tasks selected is rejected before it ever posts', async ({ page }) => {
  await loginAsTeacher(page);
  // An in-page click, not page.goto: the login redirect lands on the
  // `localhost` origin the dev magic-link is built against (AI_CONTEXT.md's
  // Gotcha on `request.url`), and a relative `page.goto` afterward resolves
  // against playwright.config.ts's `baseURL` (127.0.0.1) instead, silently
  // dropping the auth cookie — a click stays on whatever origin the browser
  // is actually on.
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Оберіть хоча б одне завдання.')).toBeVisible();
});

test('the session builder link requires a logged-in teacher', async ({ page }) => {
  await page.goto('/sessions/new');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});
