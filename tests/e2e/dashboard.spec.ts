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

/**
 * Scoped to the "Хто потребує допомоги" <section> specifically (docs/TASKS.md,
 * "Results dashboard") — with more than one assigned task, a student's row
 * in the plain attempts log below can otherwise share every filter text a
 * rollup-row lookup might use, since each log row only names one task.
 */
function rollupRowFor(page: Page, studentName: string) {
  const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Хто потребує допомоги' }) });
  return section.locator('tr').filter({ hasText: studentName });
}

test('a teacher logs in and sees a student\'s attempt on the dashboard', async ({ page }) => {
  // Complete the task as a student first, so there is something to see.
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: STUDENT_NAME }).click();
  await page.getByRole('button', { name: 'Квадрат', exact: true }).click();
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
  // The rollup table above also has a row naming the student, without the
  // task title (docs/TASKS.md, "Results dashboard") — filtering on both
  // texts finds the attempts-log row specifically, regardless of DOM order.
  // Attempts are append-only (docs/AI_CONTEXT.md) — a retried test run adds a
  // row rather than replacing one, so this matches whichever comes first
  // rather than assuming there is exactly one.
  const row = page.locator('tr').filter({ hasText: STUDENT_NAME }).filter({ hasText: 'Квадрат' }).first();
  await expect(row).toContainText('Зараховано');

  // The rollup marks the same result too, just without the task's own name
  // in the row — it is a checkmark in that task's column instead.
  await expect(rollupRowFor(page, STUDENT_NAME).getByLabel('Зараховано').first()).toBeVisible();

  // CSV export (docs/TASKS.md, "CSV export"): fetched from inside the page,
  // not via page.request — a relative URL there resolves against
  // playwright.config.ts's baseURL (127.0.0.1), while the login cookie was
  // set for the `localhost` origin the magic-link redirect landed on
  // (the same origin/baseURL split session-builder.spec.ts's loginAsTeacher
  // works around). An in-page fetch uses the page's actual origin and
  // cookies, exercising the real ownership-scoped route.
  const exportLink = page.getByRole('link', { name: 'Завантажити CSV' });
  await expect(exportLink).toBeVisible();
  const exportUrl = await exportLink.getAttribute('href');
  if (!exportUrl) throw new Error('export link rendered with no href');
  const result = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, contentType: response.headers.get('content-type'), body: await response.text() };
  }, exportUrl);
  expect(result.status).toBe(200);
  expect(result.contentType).toContain('text/csv');
  expect(result.body).toContain(STUDENT_NAME);
  expect(result.body).toContain('Квадрат');
  expect(result.body).toContain('Зараховано');
});

test('the rollup shows a student who has tried a task but never passed it', async ({ page }) => {
  const STUCK_STUDENT = 'Соломія';

  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: STUCK_STUDENT }).click();
  await page.getByRole('button', { name: 'Квадрат', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  // A rectangle, not a square — fails on purpose.
  await typeSolution(
    page,
    'import turtle\nfor i in range(2):\n    turtle.forward(150)\n    turtle.right(90)\n    turtle.forward(100)\n    turtle.right(90)'
  );
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  const href = await requestLoginLink(page, TEACHER_EMAIL);
  await page.goto(href);
  await page.getByRole('link', { name: /DEMO01/ }).click();
  await expect(page.getByRole('heading', { name: 'Заняття DEMO01' })).toBeVisible();

  const rollupRow = rollupRowFor(page, STUCK_STUDENT);
  await expect(rollupRow).toContainText('Потребує уваги: 1');
  await expect(rollupRow.getByLabel(/Не зараховано, спроб: \d+/)).toBeVisible();
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
