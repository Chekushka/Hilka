import { expect, test, type Page } from '@playwright/test';

/**
 * The class table (docs/TASKS.md, "Class table"): who is working, who needs
 * help, who has finished, as a shape and a word per student, stuck students
 * on top. Its own practice session with one quiz, so the states are exact:
 * one student passes, one fails three Checks (the stuck rule,
 * lib/dashboard/class-status.ts), one does nothing.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const QUIZ_TITLE = "Правильне ім'я змінної";

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
}

async function checkOption(page: Page, option: string, expected: 'Готово!' | 'Ще не те') {
  await page.getByLabel(option, { exact: true }).check();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  await expect(page.getByRole('heading', { name: expected })).toBeVisible();
}

test('the class table shows who is stuck, who has finished and who has not started', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Змінні' });
  await page.getByRole('listitem').filter({ hasText: QUIZ_TITLE }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  await page.getByRole('button', { name: QUIZ_TITLE }).click();
  await checkOption(page, 'x1', 'Готово!');

  // A second tab: the room remembers the picked name per tab (sessionStorage).
  const other = await page.context().newPage();
  await other.goto(`/s/${code.toLowerCase()}`);
  await other.getByRole('button', { name: 'Тарас' }).click();
  await other.getByRole('button', { name: QUIZ_TITLE }).click();
  for (const option of ['1x', 'x-1', 'x 1']) {
    await checkOption(other, option, 'Ще не те');
  }
  await other.close();

  await loginAsTeacher(page);
  await page.getByRole('link', { name: new RegExp(code) }).click();
  const table = page.getByRole('region', { name: 'Учні заняття' });
  const rows = table.locator('tr[data-state]');
  await expect(rows).toHaveCount(3);

  // Stuck first, then not started, finished last — each with its word.
  await expect(rows.nth(0)).toHaveAttribute('data-state', 'stuck');
  await expect(rows.nth(0)).toContainText('Тарас');
  await expect(rows.nth(0)).toContainText('Потребує допомоги');
  await expect(rows.nth(0).getByLabel(`1. ${QUIZ_TITLE}: Не зараховано, спроб: 3`)).toBeVisible();
  await expect(rows.nth(1)).toHaveAttribute('data-state', 'not_started');
  await expect(rows.nth(1)).toContainText('Соломія');
  await expect(rows.nth(1)).toContainText('Не розпочато');
  await expect(rows.nth(2)).toHaveAttribute('data-state', 'finished');
  await expect(rows.nth(2)).toContainText('Олена');
  await expect(rows.nth(2)).toContainText('Завершено');
  await expect(rows.nth(2)).toContainText('1 з 1');

  await expect(page.getByText('Потребують допомоги: 1')).toBeVisible();
  await expect(page.getByText('Завершили: 1')).toBeVisible();
  await expect(page.getByText('Ще не почали: 1')).toBeVisible();
  await expect(page.getByText('Працюють: 0')).toBeVisible();

  const taskSummary = page.getByRole('region', { name: 'Завдання заняття' });
  await expect(taskSummary).toContainText('Зараховано: 1');
  await expect(taskSummary).toContainText('Не виходить: 1');
  await expect(taskSummary).toContainText('Не бралися: 1');
});
