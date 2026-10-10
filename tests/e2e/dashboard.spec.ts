import { expect, test, type Page } from '@playwright/test';

/**
 * Login (magic link, dev-mode stand-in — no email provider exists yet) and
 * the read-only dashboard. Uses the same demo session as tests/e2e/session.spec.ts
 * but a different student name, so the two files' attempts never collide
 * even if a runner executes them in parallel against the shared database.
 */

const DEMO_CODE = 'demo01';
// The square's row in the room: its title, then — since the room restores a student's
// attempts — maybe its mark from an earlier spec in this run. Other titles contain «Квадрат».
const SQUARE_ROW = /^Квадрат(\s?Виконано)?$/;
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
 * The class table's row for a student (docs/TASKS.md, "Class table") — its
 * rows carry `data-state`, which the attempts log's rows do not.
 */
function classRowFor(page: Page, studentName: string) {
  return page.getByRole('region', { name: 'Учні заняття' }).locator('tr[data-state]').filter({ hasText: studentName });
}

/** The attempts log, collapsed under its summary — toContainText reads it without opening. */
function attemptsLog(page: Page) {
  return page.getByRole('region', { name: /Усі спроби/ });
}

/**
 * A task's line in the per-task summary. The demo session assigns every
 * published task, too many for the class table's per-task strip, so the
 * summary is where a single task's result shows.
 */
function taskSummaryFor(page: Page, title: string) {
  return page
    .getByRole('region', { name: 'Завдання заняття' })
    .getByRole('listitem')
    .filter({ has: page.getByText(new RegExp(`^\\d+\\. ${title}$`)) });
}

test('a teacher logs in and sees a student\'s attempt on the dashboard', async ({ page }) => {
  // Complete the task as a student first, so there is something to see.
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: STUDENT_NAME }).click();
  await page.getByRole('button', { name: SQUARE_ROW }).click();
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Здати' }).click()
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
  const row = attemptsLog(page).locator('tr').filter({ hasText: STUDENT_NAME }).filter({ hasText: 'Квадрат' }).first();
  await expect(row).toContainText('Зараховано');

  // The class table has the student working or done, and the task summary counts the pass.
  await expect(classRowFor(page, STUDENT_NAME)).toHaveAttribute('data-state', /working|stuck|finished/);
  await expect(taskSummaryFor(page, 'Квадрат')).toContainText(/Зараховано: [1-9]/);

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

test('the class table shows a student who has tried a task but never passed it', async ({ page }) => {
  const STUCK_STUDENT = 'Соломія';

  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: STUCK_STUDENT }).click();
  await page.getByRole('button', { name: SQUARE_ROW }).click();
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  // A rectangle, not a square — fails on purpose.
  await typeSolution(
    page,
    'import turtle\nfor i in range(2):\n    turtle.forward(150)\n    turtle.right(90)\n    turtle.forward(100)\n    turtle.right(90)'
  );
  await Promise.all([
    page.waitForResponse(
      (response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Здати' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  const href = await requestLoginLink(page, TEACHER_EMAIL);
  await page.goto(href);
  await page.getByRole('link', { name: /DEMO01/ }).click();
  await expect(page.getByRole('heading', { name: 'Заняття DEMO01' })).toBeVisible();

  // One failed Check is "working", not yet "needs help" — but the shared
  // demo session keeps this student's failures from earlier runs, so either.
  const classRow = classRowFor(page, STUCK_STUDENT);
  await expect(classRow).toHaveAttribute('data-state', /working|stuck/);
  await expect(taskSummaryFor(page, 'Квадрат')).toContainText(/Не виходить: [1-9]/);
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
