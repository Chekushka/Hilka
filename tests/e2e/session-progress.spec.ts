import { expect, test, type Page } from '@playwright/test';

/**
 * The student's progress in a session (lib/session/progress.ts): Checks left
 * per task and altogether, a progress bar, and the results once nothing is
 * left to do — in a graded lesson and in homework, through a reload. Quiz
 * tasks, so nothing waits for the Python engine.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const PRINT = 'Навіщо потрібна функція print()';
const PRINT_RIGHT = 'Виводить текст або значення на екран';
const PRINT_WRONG = 'Зчитує число від користувача';
const DIVISION = 'Цілочисельне ділення';
const DIVISION_RIGHT = '3';
const DIVISION_WRONG = '3.5';

const taskRow = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });

/** Navigates on the origin the login landed on — its cookie is scoped there (AI_CONTEXT.md, Gotchas). */
const go = (page: Page, path: string) => page.goto(new URL(path, page.url()).toString());

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function buildSession(page: Page, mode: 'graded' | 'homework'): Promise<string> {
  await loginAsTeacher(page);
  await go(page, '/sessions/new');
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption(mode);
  for (const title of [PRINT, DIVISION]) {
    await page.locator('#taskSearch').fill(title);
    await page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) }).getByRole('checkbox').check();
  }
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  return ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
}

async function answer(page: Page, title: string, option: string) {
  await taskRow(page, title).click();
  await page.getByLabel(option, { exact: true }).check();
  await page.getByRole('button', { name: 'Здати' }).click();
}

test('a graded lesson counts Checks down and shows the results at the end', async ({ browser, page }) => {
  const code = await buildSession(page, 'graded');
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name: 'Тарас', exact: true }).click();

  await expect(student.getByTestId('session-progress')).toContainText("Розв'язано: 0 з 2");
  await expect(student.getByTestId('checks-left-total')).toHaveText('Залишилось спроб: 2');
  await expect(taskRow(student, PRINT).getByTestId('task-checks-left')).toHaveText('спроб: 1');
  await expect(student.getByTestId('session-results')).toHaveCount(0);

  await taskRow(student, PRINT).click();
  await expect(student.getByTestId('workspace-checks-left')).toHaveText('Спроб: 1');
  await student.getByRole('button', { name: /До списку завдань/ }).click();

  // A graded lesson locks a task at its first Check and says so.
  await answer(student, PRINT, PRINT_RIGHT);
  await expect(student.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await student.getByRole('button', { name: '← До списку завдань' }).click();
  await expect(student.getByTestId('session-progress')).toContainText("Розв'язано: 1 з 2");
  await expect(student.getByTestId('checks-left-total')).toHaveText('Залишилось спроб: 1');
  await expect(student.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');

  await answer(student, DIVISION, DIVISION_WRONG);
  await expect(student.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await student.getByRole('button', { name: '← До списку завдань' }).click();
  const results = student.getByTestId('session-results');
  await expect(results).toContainText('Заняття завершено');
  await expect(results).toContainText("Розв'язано 1 з 2.");
  await expect(results).toContainText('Не зараховано: 1');
  await expect(student.getByTestId('checks-left-total')).toHaveText('Залишилось спроб: 0');

  // Read back from the server, not just remembered by the page.
  await student.reload();
  await expect(student.getByTestId('session-results')).toContainText("Розв'язано 1 з 2.");
  await student.context().close();
});

test('homework shows fixes left and, once done, how each task was counted', async ({ browser, page }) => {
  const code = await buildSession(page, 'homework');
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name: 'Соломія', exact: true }).click();

  await expect(student.getByTestId('checks-left-total')).toHaveText('Залишилось спроб: 6');
  await expect(taskRow(student, PRINT).getByTestId('task-checks-left')).toHaveText('спроб: 3');

  await answer(student, PRINT, PRINT_WRONG);
  await expect(student.getByTestId('workspace-checks-left')).toHaveText('Спроб: 2');
  await student.getByLabel(PRINT_RIGHT, { exact: true }).check();
  await student.getByRole('button', { name: 'Здати' }).click();
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await student.getByRole('button', { name: /До списку завдань/ }).first().click();
  await expect(student.getByTestId('session-progress')).toContainText("Розв'язано: 1 з 2");
  await answer(student, DIVISION, DIVISION_RIGHT);
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await student.getByRole('button', { name: /До списку завдань/ }).first().click();

  const results = student.getByTestId('session-results');
  await expect(results).toContainText('Домашнє завдання виконано!');
  await expect(results).toContainText("Розв'язано 2 з 2.");
  await expect(results).toContainText('З першої спроби: 1');
  await expect(results).toContainText('Після виправлення: 1 — зараховується на 70%');
  await expect(results).toContainText('Учитель уже бачить твої результати.');
  await student.context().close();
});
