import { expect, test, type Page } from '@playwright/test';

/**
 * The student card (docs/TASKS.md, "Student card"): a teacher opens one
 * student of a session and sees every attempt with what was submitted —
 * the option picked in a quiz, the code checked in a code task — plus the
 * totals. Its own practice-mode session, so attempts from other specs on
 * the demo session never show up here.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const QUIZ_TITLE = "Правильне ім'я змінної";
const CODE_TITLE = 'Більше з двох чисел';
const STUDENT = 'Соломія';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
}

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function check(page: Page) {
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Здати' }).click()
  ]);
}

test('the student card shows each attempt with what was submitted', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Змінні' });
  await page.getByRole('listitem').filter({ hasText: QUIZ_TITLE }).getByRole('checkbox').check();
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Розгалуження: умовний оператор if' });
  await page.getByRole('listitem').filter({ hasText: CODE_TITLE }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  // The student: a wrong option, then the right one; then a code task that
  // passes two of three cases.
  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: STUDENT }).click();
  await page.getByRole('button', { name: QUIZ_TITLE }).click();
  await page.getByLabel('1x', { exact: true }).check();
  await check(page);
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();
  await page.getByLabel('x1', { exact: true }).check();
  await check(page);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: CODE_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  await typeSolution(page, 'a = int(input())\nb = int(input())\nprint(b)');
  await check(page);
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  // The teacher opens the card from the session page.
  await loginAsTeacher(page);
  await page.getByRole('link', { name: new RegExp(code) }).click();
  await page.getByRole('link', { name: `Картка учня ${STUDENT}` }).click();
  await expect(page.getByRole('heading', { name: STUDENT, level: 1 })).toBeVisible();

  await expect(page.getByText('Спроб', { exact: true }).locator('..')).toContainText('3');
  await expect(page.getByText('Завдань виконано').locator('..')).toContainText('1 з 2');

  const quiz = page.locator('article').filter({ hasText: `1. ${QUIZ_TITLE}` });
  await expect(quiz).toContainText('Спроб: 2');
  // The latest attempt is open, with the picked option marked.
  const latestQuiz = quiz.locator('details[open]');
  await expect(latestQuiz).toHaveCount(1);
  await expect(latestQuiz.locator('summary')).toContainText('Спроба 2');
  await expect(latestQuiz.locator('summary')).toContainText('зараховано');
  await expect(latestQuiz.locator('li').filter({ hasText: 'x1' })).toContainText('обрано');
  // The first, failed one is there too, collapsed; opening it shows the wrong pick.
  const firstQuiz = quiz.locator('details').filter({ hasText: 'Спроба 1' });
  await firstQuiz.locator('summary').click();
  await expect(firstQuiz.locator('summary')).toContainText('не зараховано');
  await expect(firstQuiz.locator('li').filter({ hasText: '1x' })).toContainText('обрано');

  const codeTask = page.locator('article').filter({ hasText: `2. ${CODE_TITLE}` });
  await expect(codeTask.locator('summary')).toContainText('тестів пройдено: 67%');
  await expect(codeTask.getByText('print(b)')).toBeVisible();

  const timeline = page.locator('aside').filter({ has: page.getByRole('heading', { name: 'Хронологія спроб' }) });
  await expect(timeline.getByRole('listitem')).toHaveCount(3);
  await expect(timeline.getByRole('listitem').first()).toContainText(`2. ${CODE_TITLE}: ще не вийшло`);

  // A name that is not in the session is not a card. The page's own origin,
  // not a relative path: the login cookie lives on the origin the magic link
  // landed on (docs/AI_CONTEXT.md, Gotchas).
  const missing = page.url().replace(/students\/[^/]+$/, `students/${encodeURIComponent('Нікого')}`);
  const response = await page.goto(missing);
  expect(response?.status()).toBe(404);
});
