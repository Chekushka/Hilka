import { expect, test, type Page } from '@playwright/test';

/**
 * The visual builders in the authoring forms (docs/TASKS.md, "Task authoring
 * UI"): a teacher builds checks, a run case, hints and grades without typing
 * any JSON, saves, and publishes. The builder writes the same JSON the
 * textarea used to take — the JSON-mode view proves it — and enforces
 * TASK_SCHEMA.md's "no stdout_equals on a task with cases" in the form itself.
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

async function typeIntoEditor(page: Page, nth: number, code: string) {
  const editor = page.locator('.cm-content').nth(nth);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function openNewTask(page: Page) {
  await loginAsTeacher(page);
  // In-app clicks, not page.goto — see task-authoring-ui.spec.ts on the login redirect's origin.
  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();
}

const addKind = (page: Page) => page.getByLabel('Тип нової перевірки').first();

test('a teacher builds checks, a case, hints and grades without JSON, then publishes', async ({ page }) => {
  await openNewTask(page);
  await page.getByLabel('Середовище').selectOption('console');
  const slug = `e2e-builder-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('Конструктор: периметр');
  await page.getByLabel('Умова').fill('Прочитай довжину і ширину прямокутника, виведи периметр.');

  // One check, built field by field — a decimal comma is accepted as typed.
  await addKind(page).selectOption({ label: 'Число у виведенні' });
  await page.getByRole('button', { name: 'Додати перевірку' }).first().click();
  await page.getByLabel('Очікуване значення').fill('16');
  await page.getByLabel('Допустима похибка').fill('0,01');
  await page.getByLabel(/Повідомлення учневі/).fill('Периметр — це сума всіх чотирьох сторін.');

  // Exact output comparison is still offered while the task has no cases…
  await expect(addKind(page).locator('option', { hasText: 'Виведення збігається повністю' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Додати випадок' }).click();
  await page.getByLabel('Ввід — по одному рядку на кожен input()').fill('5\n3');
  await page.getByLabel(/Підпис випадку/).fill('звичайний випадок');
  // …and gone once it has one (docs/TASK_SCHEMA.md, "Rules that are not optional").
  await expect(addKind(page).locator('option', { hasText: 'Виведення збігається повністю' })).toHaveCount(0);
  await expect(page.getByText(/Недоступно: у завдання є тестові випадки/).first()).toBeVisible();

  await page.getByLabel('Підказка 1').fill('Додай довжину і ширину, а потім помнож на 2.');
  await page.getByRole('button', { name: 'Додати підказку' }).click();
  await page.getByLabel('Підказка 2').fill('print(2 * (a + b))');
  await page.getByLabel('7 клас').check();
  await page.getByLabel(/Складність/).fill('2');

  // The builder wrote exactly the JSON a teacher would have typed.
  await page.locator('button[aria-controls="checks"]', { hasText: 'JSON' }).click();
  const checksJson = JSON.parse(await page.getByLabel('Перевірки (JSON)').inputValue());
  expect(checksJson).toEqual([
    { kind: 'number_close', value: 16, tol: 0.01, which: 'last', message: 'Периметр — це сума всіх чотирьох сторін.' }
  ]);
  await page.locator('button[aria-controls="checks"]', { hasText: 'Конструктор' }).click();

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();

  // The draft editor opens the saved task in the same builders.
  await expect(page.getByLabel('Очікуване значення')).toHaveValue('16');
  await expect(page.getByLabel('Ввід — по одному рядку на кожен input()')).toHaveValue('5\n3');
  await expect(page.getByLabel('Підказка 2')).toHaveValue('print(2 * (a + b))');
  await expect(page.getByLabel('7 клас')).toBeChecked();
  await expect(page.getByLabel('8 клас')).not.toBeChecked();

  await typeIntoEditor(page, 1, 'a = float(input())\nb = float(input())\nprint(2 * (a + b))');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a check the builder cannot show is edited as JSON in place, and kinds follow the task type', async ({ page }) => {
  await openNewTask(page);

  // A quiz is judged by the chosen option only.
  await page.getByLabel('Тип завдання').selectOption('quiz');
  await expect(addKind(page).locator('option')).toHaveText(['Обраний варіант відповіді']);

  await page.getByLabel('Тип завдання').selectOption('code');
  await page.getByLabel('Середовище').selectOption('turtle');
  await addKind(page).selectOption({ label: 'Малюнок містить відрізки' });
  await page.getByRole('button', { name: 'Додати перевірку' }).first().click();
  // shape_contains's segments have no form control: that one check becomes a JSON box.
  await expect(page.getByText(/конструктор не показує — редагуй її як JSON/)).toBeVisible();

  // A turtle shape check starts with "any position" ticked, as TASK_SCHEMA recommends.
  await addKind(page).selectOption({ label: 'Малюнок як в еталоні' });
  await page.getByRole('button', { name: 'Додати перевірку' }).first().click();
  await expect(page.getByLabel('зсув (будь-яке місце)')).toBeChecked();

  // Remove the first check; the shape check moves up and keeps its settings.
  await page.getByRole('button', { name: 'Видалити' }).first().click();
  await expect(page.getByText(/конструктор не показує/)).toHaveCount(0);
  await expect(page.getByLabel('зсув (будь-яке місце)')).toBeChecked();
});
