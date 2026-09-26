import { expect, test, type Page } from '@playwright/test';

/**
 * Teacher-side lesson authoring (docs/TASKS.md, "Lessons"): a teacher creates
 * a lesson from the form, previews its explanation, orders core and additional
 * tasks, sees a rule violation come back as a Ukrainian message, finds the
 * lesson on the student side, edits it, and deletes it again — leaving the
 * seeded grade 7 lessons exactly as other specs expect them.
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

async function addTask(page: Page, list: 'Основні завдання' | 'Додаткові завдання', search: string) {
  await page.getByLabel(`Пошук завдання для списку «${list}»`).fill(search);
  await page
    .getByRole('region', { name: list })
    .getByRole('button', { name: 'Додати' })
    .click();
}

test('a teacher creates, previews, edits and deletes a lesson, and students see it in between', async ({ page }) => {
  await loginAsTeacher(page);
  // In-app clicks, not page.goto — see task-authoring-ui.spec.ts on the login redirect's origin.
  await page.getByRole('link', { name: 'Уроки' }).click();
  await expect(page.getByRole('heading', { name: 'Уроки', level: 1 })).toBeVisible();
  // The seeded grade 7 lessons are listed.
  await expect(page.getByRole('link', { name: 'Перша програма' })).toBeVisible();
  await page.getByRole('link', { name: 'Новий урок' }).click();
  await expect(page.getByRole('heading', { name: 'Новий урок' })).toBeVisible();

  const slug = `e2e-lesson-${Date.now()}`;
  await page.getByLabel('Назва', { exact: true }).fill('Друк і змінні — повторення');
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Практика').check();
  await page
    .getByLabel('Пояснення (Markdown)')
    .fill('# Повторюємо\n\nФункція `print` виводить **текст**.\n\n```\nprint("Привіт")\n```');

  // The preview is the same component a student sees.
  await page.getByRole('button', { name: 'Показати, як побачить учень' }).click();
  const preview = page.getByRole('region', { name: 'Перегляд пояснення' });
  await expect(preview.getByRole('heading', { name: 'Повторюємо' })).toBeVisible();
  await expect(preview.locator('pre')).toHaveText('print("Привіт")');

  // No core task yet: the server refuses, and says why.
  await addTask(page, 'Додаткові завдання', 'Навіщо потрібна функція print');
  await page.getByRole('button', { name: 'Створити урок' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('Додай хоча б одне основне завдання.');

  // Moving the task across makes it core; then an additional one goes after it.
  await page.getByRole('button', { name: 'Перенести до основних' }).click();
  await addTask(page, 'Основні завдання', "Правильне ім'я змінної");
  await addTask(page, 'Додаткові завдання', 'Периметр прямокутника');
  const core = page.getByRole('region', { name: 'Основні завдання' }).getByRole('listitem');
  await expect(core).toHaveCount(2);
  await expect(core.first()).toContainText('Навіщо потрібна функція print()');
  // Reorder: the variable-name quiz first.
  await core.nth(1).getByRole('button', { name: 'Вище' }).click();
  await expect(core.first()).toContainText("Правильне ім'я змінної");

  await page.getByRole('button', { name: 'Створити урок' }).click();
  await expect(page.getByRole('heading', { name: 'Урок «Друк і змінні — повторення»' })).toBeVisible();
  await expect(page.getByLabel('Ідентифікатор (slug)')).toHaveAttribute('readonly', '');

  // The student side shows it at once: explanation, then the tasks in the chosen order.
  await page.getByRole('link', { name: 'Відкрити як учень' }).click();
  await expect(page.getByRole('heading', { name: 'Друк і змінні — повторення', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Повторюємо' })).toBeVisible();
  const studentTasks = await page.getByRole('main').getByRole('listitem').allTextContents();
  expect(studentTasks.map((text) => text.replace(/^\d+\./, '').trim())).toEqual([
    expect.stringContaining("Правильне ім'я змінної"),
    expect.stringContaining('Навіщо потрібна функція print()'),
    expect.stringContaining('Периметр прямокутника')
  ]);
  await page.goBack();

  // Edit: a new title is saved in place.
  await page.getByLabel('Назва', { exact: true }).fill('Друк і змінні');
  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByText('Збережено. Учні вже бачать зміни.')).toBeVisible();

  // Delete, confirming the dialog; the lesson leaves the list.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Видалити урок' }).click();
  await expect(page.getByRole('heading', { name: 'Уроки', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Друк і змінні', exact: true })).toHaveCount(0);
});

test('a ministry number already used in the grade is refused', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Уроки' }).click();
  await page.getByRole('link', { name: 'Новий урок' }).click();

  await page.getByLabel('Назва', { exact: true }).fill('Дубль');
  await page.getByLabel('Ідентифікатор (slug)').fill(`e2e-dup-${Date.now()}`);
  // Grade 7 lesson 25 is the seeded «Перша програма».
  await page.getByLabel('Номер уроку за програмою').fill('25');
  await addTask(page, 'Основні завдання', 'Навіщо потрібна функція print');
  await page.getByRole('button', { name: 'Створити урок' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('У цьому класі вже є урок з таким номером.');
});
