import { expect, test, type Page } from '@playwright/test';

/**
 * Lessons as the unit of content (docs/AI_CONTEXT.md, "Course Structure"):
 * the student walks grade → lesson → explanation → core then additional
 * tasks, and the session builder adds a whole lesson and warns in graded
 * mode about material that should not be graded. Reads the grade 7 lessons
 * `npm run db:seed` imports from content/lessons/.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

test('the practice page lists grade 7 lessons in order, practice lessons marked skippable', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Уроки' })).toBeVisible();

  const lessons = page.getByRole('listitem');
  await expect(lessons.first()).toContainText('Урок 25');
  await expect(lessons.first()).toContainText('Перша програма');
  await expect(lessons.first()).toContainText("Обов'язковий");

  const texts = await lessons.allTextContents();
  const numbers = texts.map((text) => Number(/Урок (\d+)/.exec(text)?.[1]));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));

  const linear = lessons.filter({ hasText: 'Лінійний алгоритм' });
  await expect(linear).toContainText('Практика');
  await expect(linear).toContainText('Можна пропустити, але краще не варто.');
});

test('a lesson shows the explanation, then core tasks, then additional tasks', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('link', { name: /Лінійний алгоритм/ }).click();

  await expect(page.getByRole('heading', { name: 'Лінійний алгоритм', level: 1 })).toBeVisible();
  // The explanation's code example is static text, not an editor.
  await expect(page.locator('pre').first()).toContainText('area = length * width');
  await expect(page.locator('.cm-content')).toHaveCount(0);

  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(headings).toEqual(['Основні завдання', 'Додаткові завдання']);

  const taskLinks = await page.getByRole('main').getByRole('listitem').allTextContents();
  expect(taskLinks.map((text) => text.replace(/^\d+\./, '').trim())).toEqual([
    'Периметр прямокутника',
    'Площа прямокутника',
    'Середнє трьох чисел',
    'Вартість поїздки'
  ]);

  // The next-task link walks core into additional.
  await page.getByRole('link', { name: /Площа прямокутника/ }).click();
  await page.getByRole('link', { name: 'Наступне завдання →' }).click();
  await expect(page.getByRole('heading', { name: 'Середнє трьох чисел' })).toBeVisible();
  await page.getByRole('link', { name: 'Наступне завдання →' }).click();
  await expect(page.getByRole('heading', { name: 'Вартість поїздки' })).toBeVisible();
  await expect(page.getByText('Це останнє завдання уроку.')).toBeVisible();
});

test('solving a task marks it done in the lesson and on the lesson list', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle');
  await page.getByRole('link', { name: /^1\.\s*Квадрат/ }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });

  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  await page.getByRole('link', { name: /До уроку/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: /^1\.\s*Квадрат/ })).toContainText('виконано');
  await page.getByRole('link', { name: 'Усі уроки' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Черепашка малює' })).toContainText('1 з 3');
});

test('a parameterized task is listed in its lesson but only opens in a session', async ({ page }) => {
  await page.goto('/practice/g7-30-turtle-shapes');
  const star = page.getByRole('listitem').filter({ hasText: 'Зірка (своя сторона)' });
  await expect(star).toContainText('лише на занятті з учителем');
  await expect(star.getByRole('link')).toHaveCount(0);

  const response = await page.goto('/practice/g7-30-turtle-shapes/g7-code-turtle-star-variant');
  expect(response?.status()).toBe(404);
});

test('the session builder adds a whole lesson and warns in graded mode', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await expect(page.getByRole('heading', { name: 'Нове заняття' })).toBeVisible();

  await page.getByLabel('Режим').selectOption('graded');

  // A mandatory lesson's core tasks: graded material, no warning.
  await page.getByLabel('Додати урок цілком').selectOption({ label: "7 кл. · урок 29: Черепашка малює (Обов'язковий)" });
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 3')).toBeVisible();
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);

  // A practice lesson with an additional task: both kinds of warning.
  await page.getByLabel('Додати урок цілком').selectOption({ label: '7 кл. · урок 28: Лінійний алгоритм (Практика)' });
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 7')).toBeVisible();
  const warning = page.locator('form').getByRole('alert');
  await expect(warning).toContainText('Периметр прямокутника — з практичного уроку');
  await expect(warning).toContainText('Площа прямокутника — з практичного уроку');
  await expect(warning).toContainText('Середнє трьох чисел — додаткове');
  await expect(warning).toContainText('Вартість поїздки — додаткове');
  await expect(warning).not.toContainText('Сходинки');

  // Adding the same lesson again changes nothing.
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 7')).toBeVisible();

  // Practice mode never warns.
  await page.getByLabel('Режим').selectOption('practice');
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);

  // The warning does not block: a graded session with these tasks is created.
  await page.getByLabel('Режим').selectOption('graded');
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
});
