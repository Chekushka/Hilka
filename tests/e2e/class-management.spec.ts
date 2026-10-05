import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Class + roster management (docs/TASKS.md, "Class + roster management"): a
 * teacher creates a class from the UI — a grade, names typed one by one and a
 * whole list pasted at once — comes back to edit it, renames a student
 * without losing their results, deletes a session from the class, and
 * finally deletes the class.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const QUIZ = 'Навіщо потрібна функція print()';
const QUIZ_RIGHT = 'Виводить текст або значення на екран';

/** Navigates on the origin the login landed on — its cookie is scoped there (AI_CONTEXT.md, Gotchas). */
const go = (page: Page, path: string) => page.goto(new URL(path, page.url()).toString());

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

const classCard = (page: Page, title: string) =>
  page.locator('li[data-class-id]').filter({ has: page.getByRole('heading', { name: title }) });

async function createClass(page: Page, title: string, names: string[], grade?: string) {
  await go(page, '/classes/new');
  await page.getByLabel('Назва класу').fill(title);
  if (grade) await page.getByLabel('Рівень (клас програми)').selectOption({ label: grade });
  for (const name of names) {
    await page.getByLabel('Додати учня').fill(name);
    await page.getByLabel('Додати учня').press('Enter');
  }
  await page.getByRole('button', { name: 'Створити клас' }).click();
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
}

test('a teacher builds a roster by typing, pasting and sorting, then edits the class', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Новий клас' }).click();
  await expect(page.getByRole('heading', { name: 'Новий клас' })).toBeVisible();

  const className = `Тестовий клас ${Date.now()}`;
  await page.getByLabel('Назва класу').fill(className);
  await page.getByLabel('Рівень (клас програми)').selectOption({ label: '8 клас' });

  // One at a time: Enter adds and keeps the field ready for the next.
  const add = page.getByLabel('Додати учня');
  await add.fill('Марія');
  await add.press('Enter');
  await expect(add).toHaveValue('');
  await expect(add).toBeFocused();

  // A numbered list pasted at once; a name already there is skipped and said so.
  await page.getByRole('button', { name: 'Вставити список' }).click();
  await page.getByLabel('Список учнів, по одному на рядок').fill('1. Іван\n2. марія\n3. Петро');
  await page.getByRole('button', { name: 'Додати всіх' }).click();
  await expect(page.getByTestId('roster-feedback')).toContainText('Додано: 2.');
  await expect(page.getByTestId('roster-feedback')).toContainText('Уже є в списку: марія.');
  await expect(page.getByRole('heading', { name: 'Учні: 3' })).toBeVisible();

  await page.getByRole('button', { name: 'Упорядкувати за абеткою' }).click();
  await expect(page.getByTestId('roster-list').getByRole('listitem')).toHaveText([/Іван/, /Марія/, /Петро/]);

  await page.getByRole('button', { name: 'Прибрати «Петро»' }).click();
  await page.getByRole('button', { name: 'Створити клас' }).click();

  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  const card = classCard(page, className);
  await expect(card).toBeVisible();
  await expect(card.getByText('8 клас')).toBeVisible();
  await expect(card.getByText('Учні (2): Іван, Марія')).toBeVisible();

  // The class's grade opens the session builder's bank on it.
  await card.getByRole('link', { name: 'Почати заняття' }).click();
  await expect(page.locator('#class')).toHaveValue(/.+/);
  await expect(page.locator('#class option:checked')).toHaveText(className);
  await expect(page.locator('#gradeFilter')).toHaveValue('8');

  await go(page, '/dashboard');
  await classCard(page, className).getByRole('link', { name: 'Редагувати' }).click();
  await expect(page.getByRole('heading', { name: `Редагування класу: ${className}` })).toBeVisible();
  const renamed = `${className} (перейменовано)`;
  await page.getByLabel('Назва класу').fill(renamed);
  await page.getByLabel('Додати учня').fill('Петро');
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await page.getByRole('button', { name: 'Зберегти' }).click();

  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  await expect(classCard(page, renamed).getByText('Учні (3): Іван, Марія, Петро')).toBeVisible();
});

test('creating a class without a roster is rejected before it ever posts', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Новий клас' }).click();
  await page.getByLabel('Назва класу').fill('Клас без учнів');
  await page.getByRole('button', { name: 'Створити клас' }).click();
  await expect(page.getByText('Додай хоча б одного учня.')).toBeVisible();
});

test('the new-class page requires a logged-in teacher', async ({ page }) => {
  await page.goto('/classes/new');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});

async function buildLesson(page: Page, classTitle: string): Promise<{ code: string; sessionUrl: string }> {
  await go(page, '/sessions/new');
  await page.locator('#class').selectOption({ label: classTitle });
  await page.locator('#taskSearch').fill(QUIZ);
  await page.getByRole('listitem').filter({ has: page.getByText(QUIZ, { exact: true }) }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
  const sessionUrl = (await page.getByRole('link', { name: 'Переглянути заняття' }).getAttribute('href')) ?? '';
  return { code, sessionUrl };
}

async function solveAs(browser: Browser, code: string, name: string) {
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name, exact: true }).click();
  await student.getByRole('button', { name: new RegExp(`^${QUIZ.replace(/[()]/g, '\\$&')}`) }).click();
  await student.getByLabel(QUIZ_RIGHT, { exact: true }).check();
  await student.getByRole('button', { name: 'Перевірити' }).click();
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await student.context().close();
}

test('renaming a student keeps their results; sessions and the class can be deleted', async ({ browser, page }) => {
  await loginAsTeacher(page);
  const className = `Клас для перейменування ${Date.now()}`;
  await createClass(page, className, ['Оленка', 'Тарас']);
  const { code, sessionUrl } = await buildLesson(page, className);
  await solveAs(browser, code, 'Оленка');

  // The name with work is marked; renaming it moves the work along.
  await go(page, '/dashboard');
  await classCard(page, className).getByRole('link', { name: 'Редагувати' }).click();
  const olenka = page.getByTestId('roster-list').getByRole('listitem').filter({ hasText: 'Оленка' });
  await expect(olenka.getByText('є результати')).toBeVisible();
  await olenka.getByRole('button', { name: 'Змінити' }).click();
  await page.getByLabel('Нове ім\'я для «Оленка»').fill('Олена');
  await page.getByLabel('Нове ім\'я для «Оленка»').press('Enter');
  await expect(page.getByText('було: Оленка')).toBeVisible();
  await page.getByRole('button', { name: 'Зберегти' }).click();
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();

  await go(page, sessionUrl);
  const row = page.getByRole('region', { name: 'Учні заняття' }).locator('tr[data-state]').filter({ hasText: 'Олена' });
  await expect(row).toContainText('1 з 1');
  await expect(page.getByRole('region', { name: 'Учні заняття' })).not.toContainText('Оленка');

  // A session goes from the class's list, its results with it.
  await go(page, '/dashboard');
  const card = classCard(page, className);
  await expect(card.locator(`li[data-session-code="${code}"]`)).toBeVisible();
  page.once('dialog', (dialog) => void dialog.accept());
  await card.getByRole('button', { name: `Видалити заняття ${code}` }).click();
  await expect(card.locator(`li[data-session-code="${code}"]`)).toHaveCount(0);
  await expect(card.getByText('Занять ще немає.')).toBeVisible();

  // A second session, deleted from its own page this time.
  const second = await buildLesson(page, className);
  await go(page, second.sessionUrl);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: `Видалити заняття ${second.code}` }).click();
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  await expect(classCard(page, className).getByText('Занять ще немає.')).toBeVisible();

  // And the class itself.
  await classCard(page, className).getByRole('link', { name: 'Редагувати' }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Видалити клас' }).click();
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  await expect(classCard(page, className)).toHaveCount(0);
});

test("the class and session routes refuse what is not the teacher's", async ({ page }) => {
  expect((await page.request.delete('/api/dashboard/sessions/00000000-0000-0000-0000-000000000000')).status()).toBe(401);
  expect((await page.request.delete('/api/classes/00000000-0000-0000-0000-000000000000')).status()).toBe(401);
  await loginAsTeacher(page);
  // In-page fetch: the login cookie is scoped to the page's own origin (AI_CONTEXT.md, Gotchas).
  const statuses = await page.evaluate(async () => {
    const one = await fetch('/api/dashboard/sessions/00000000-0000-0000-0000-000000000000', { method: 'DELETE' });
    const two = await fetch('/api/classes/not-a-uuid', { method: 'DELETE' });
    return [one.status, two.status];
  });
  expect(statuses).toEqual([404, 404]);
});
