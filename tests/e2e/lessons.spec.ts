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
  // Students count from 1; the ministry's lesson number stays alongside.
  await expect(lessons.first()).toContainText('Урок 1');
  await expect(lessons.first()).toContainText('№ 25 за програмою');
  await expect(lessons.first()).toContainText('Перша програма');
  await expect(lessons.first()).toContainText("Обов'язковий");

  const texts = await lessons.allTextContents();
  const numbers = texts.map((text) => Number(/Урок (\d+)/.exec(text)?.[1]));
  expect(numbers).toEqual(numbers.map((_, index) => index + 1));
  const ministryNumbers = texts.map((text) => Number(/№ (\d+) за програмою/.exec(text)?.[1]));
  expect(ministryNumbers).toEqual([...ministryNumbers].sort((a, b) => a - b));

  const linear = lessons.filter({ hasText: 'Лінійний алгоритм' });
  await expect(linear).toContainText('Практика');
  await expect(linear).toContainText('Можна пропустити, але краще не варто.');
});

test('a lesson shows the explanation, then core tasks, then additional tasks', async ({ page }) => {
  await page.goto('/practice');
  await page.getByRole('listitem').getByRole('link', { name: /Лінійний алгоритм/ }).click();

  await expect(page.getByRole('heading', { name: 'Лінійний алгоритм', level: 1 })).toBeVisible();
  // The explanation's code example is static text, not an editor.
  await expect(page.locator('pre').first()).toContainText('area = length * width');
  await expect(page.locator('.cm-content')).toHaveCount(0);

  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  expect(headings).toEqual(['Основні завдання', 'Додаткові завдання']);

  const tasks = page.getByRole('main').getByRole('listitem');
  expect(await tasks.getByTestId('lesson-task-title').allTextContents()).toEqual([
    'Периметр прямокутника',
    'Площа прямокутника',
    'Середнє трьох чисел',
    'Вартість поїздки',
    'Робот: прямо до мети',
    'Робот: поворот за ріг',
    'Робот: обійти каміння',
    // Parameterized: listed with its session-only note, and skipped by the next-task walk below.
    'Робот: свій акумулятор'
  ]);
  await expect(tasks.last()).toContainText('лише на занятті з учителем');

  // The next-task button walks core into additional.
  const nav = page.getByTestId('practice-nav');
  await page.getByRole('link', { name: /Площа прямокутника/ }).click();
  await expect(nav).toContainText('Урок 4: Лінійний алгоритм');
  await expect(nav).toContainText('Завдання 2 з 7');
  await expect(nav.getByRole('link', { name: 'Завдання 2: Площа прямокутника' })).toHaveAttribute('aria-current', 'step');
  await nav.getByRole('link', { name: 'Наступне завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Середнє трьох чисел' })).toBeVisible();
  await nav.getByRole('link', { name: 'Наступне завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Вартість поїздки' })).toBeVisible();
  for (const title of ['Робот: прямо до мети', 'Робот: поворот за ріг', 'Робот: обійти каміння']) {
    await nav.getByRole('link', { name: 'Наступне завдання' }).click();
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  // Back goes one task back; after the last task the way on is the next lesson, never a dead end.
  await nav.getByRole('link', { name: 'Попереднє' }).click();
  await expect(page.getByRole('heading', { name: 'Робот: поворот за ріг' })).toBeVisible();
  await nav.getByRole('link', { name: 'Завдання 7: Робот: обійти каміння' }).click();
  await expect(page.getByRole('heading', { name: 'Робот: обійти каміння' })).toBeVisible();
  await nav.getByRole('link', { name: 'Наступний урок' }).click();
  await expect(page.getByRole('heading', { name: 'Черепашка малює', level: 1 })).toBeVisible();
  await expect(page.getByText(/^Урок 5 з \d+$/)).toBeVisible();
  await expect(page.getByTestId('lesson-start')).toHaveText(/Почати урок/);
  await page.getByRole('link', { name: /Попередній урок/ }).click();
  await expect(page.getByRole('heading', { name: 'Лінійний алгоритм', level: 1 })).toBeVisible();
});

test('solving a task marks it done in the lesson and on the lesson list', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle');
  await page.getByRole('link', { name: /^1\.\s*Квадрат/ }).click();
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });

  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('practice-nav').getByRole('link', { name: /Урок \d+: Черепашка малює/ }).click();
  await expect(page.getByRole('listitem').filter({ hasText: /^1\.\s*Квадрат/ })).toContainText('виконано');
  // The way into the lesson now continues from the first unsolved task.
  await expect(page.getByTestId('lesson-start')).toHaveText(/Продовжити: завдання 2/);
  await page.getByRole('link', { name: 'Усі уроки' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Черепашка малює' })).toContainText('1 з 5');
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
  // Lesson 53 has no additional tasks; lesson 29's would be warned about as additional.
  await page.getByLabel('Додати урок цілком').selectOption({ label: "8 кл. · урок 53: Проєкт 1: дискримінант (Обов'язковий)" });
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 5')).toBeVisible();
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);

  // A practice lesson with an additional task: both kinds of warning.
  await page.getByLabel('Додати урок цілком').selectOption({ label: '7 кл. · урок 28: Лінійний алгоритм (Практика)' });
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 13')).toBeVisible();
  const warning = page.locator('form').getByRole('alert');
  await expect(warning).toContainText('Периметр прямокутника — з практичного уроку');
  await expect(warning).toContainText('Площа прямокутника — з практичного уроку');
  await expect(warning).toContainText('Середнє трьох чисел — додаткове');
  await expect(warning).toContainText('Вартість поїздки — додаткове');
  await expect(warning).not.toContainText('Сходинки');

  // Adding the same lesson again changes nothing.
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 13')).toBeVisible();

  // Practice mode never warns.
  await page.getByLabel('Режим').selectOption('practice');
  await expect(page.locator('form').getByRole('alert')).toHaveCount(0);

  // The warning does not block: a graded session with these tasks is created.
  await page.getByLabel('Режим').selectOption('graded');
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
});
