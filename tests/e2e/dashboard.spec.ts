import { expect, test, type Page } from '@playwright/test';

/**
 * Login (magic link, dev-mode stand-in — no email provider exists yet) and
 * the read-only dashboard. Uses the same demo session as tests/e2e/session.spec.ts
 * but a different student name, so the two files' attempts never collide
 * even if a runner executes them in parallel against the shared database.
 */

const DEMO_CODE = 'demo01';
const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const STUDENT_NAME = 'Тарас';

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function requestLoginLink(page: Page, email: string): Promise<string> {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  return href;
}

test('a teacher logs in and sees a student\'s attempt on the dashboard', async ({ page }) => {
  // Complete the task as a student first, so there is something to see.
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: STUDENT_NAME }).click();
  await page.getByRole('button', { name: 'Квадрат' }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  // Now log in as the teacher and find it.
  const href = await requestLoginLink(page, TEACHER_EMAIL);
  await page.goto(href);
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  await expect(page.getByText('Демонстраційний клас')).toBeVisible();

  await page.getByRole('link', { name: /DEMO01/ }).click();
  await expect(page.getByRole('heading', { name: 'Заняття DEMO01' })).toBeVisible();
  // Attempts are append-only (docs/AI_CONTEXT.md) — a retried test run adds a
  // row rather than replacing one, so this matches whichever comes first
  // rather than assuming there is exactly one.
  const row = page.locator('tr', { hasText: STUDENT_NAME }).first();
  await expect(row).toContainText('Квадрат');
  await expect(row).toContainText('Зараховано');

  // CSV export (docs/TASKS.md, "CSV export"): same session, same cookie —
  // page.request shares the browsing context's auth, so this exercises the
  // real ownership-scoped route rather than the button's mere presence.
  const exportLink = page.getByRole('link', { name: 'Завантажити CSV' });
  await expect(exportLink).toBeVisible();
  const exportUrl = await exportLink.getAttribute('href');
  if (!exportUrl) throw new Error('export link rendered with no href');
  const response = await page.request.get(exportUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('text/csv');
  const csv = await response.text();
  expect(csv).toContain(STUDENT_NAME);
  expect(csv).toContain('Квадрат');
  expect(csv).toContain('Зараховано');
});

test('an unknown login token bounces back to login with a calm message', async ({ page }) => {
  await page.goto('/api/auth/verify?token=not-a-real-token');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
  await expect(page.getByText('Це посилання вже недійсне. Запроси нове.')).toBeVisible();
});

test('the dashboard redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});
