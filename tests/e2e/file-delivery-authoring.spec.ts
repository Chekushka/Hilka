import { expect, test, type Page } from '@playwright/test';

/**
 * The file-delivery control in the authoring UI (docs/TASKS.md, "File
 * Delivery"): a teacher turns it on while creating a task, it survives a
 * save, and Publish stays off while the task's own programs use something
 * the student's upload would reject (docs/TASK_SCHEMA.md, "Safe subset").
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
}

async function typeIntoEditor(page: Page, nth: number, code: string) {
  const editor = page.locator('.cm-content').nth(nth);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

/** In-app link clicks, not page.goto — see task-authoring-ui.spec.ts for the origin reason. */
async function openNewTaskForm(page: Page) {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();
}

async function createDraft(page: Page) {
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
}

const FILE_TOGGLE = 'Учень працює в IDLE і надсилає файл .py';

test('a file-delivery code task is created, lint-gated, and published', async ({ page }) => {
  await openNewTaskForm(page);

  const slug = `e2e-file-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI файлове завдання');
  await page.getByLabel('Середовище').selectOption('console');
  await page.getByLabel('Умова').fill('Виведи: Привіт, файл!');
  await page.getByLabel(FILE_TOGGLE).check();
  // The name follows the slug until the teacher types one.
  await expect(page.getByLabel('Назва файлу')).toHaveValue(`${slug.replace(/-/g, '_')}.py`);
  await page.getByLabel('Назва файлу').fill('hello_file.txt');
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'stdout_equals', value: 'Привіт, файл!', trim: true }]));

  // A bad name is caught before anything is sent.
  await page.getByRole('button', { name: 'Створити чернетку' }).click();
  await expect(page.getByText('Назва файлу має закінчуватися на .py')).toBeVisible();
  await page.getByLabel('Назва файлу').fill('hello_file.py');
  await createDraft(page);

  // Saved: the draft editor reads it back from the payload.
  await expect(page.getByLabel(FILE_TOGGLE)).toBeChecked();
  await expect(page.getByLabel('Назва файлу')).toHaveValue('hello_file.py');
  await expect(page.getByLabel('Найбільший розмір, КБ')).toHaveValue('64');

  // Runs fine in Hilka, but a class is outside the file-upload safe subset.
  await typeIntoEditor(page, 1, 'class Greeter:\n    pass\nprint("Привіт, файл!")');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  const report = page.getByRole('alert').filter({ hasText: 'Учень не зможе надіслати такий код файлом' });
  await expect(report).toBeVisible({ timeout: 15_000 });
  await expect(report).toContainText('Еталонний розв’язок:');
  await expect(report).toContainText('Рядок 1:');
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeDisabled();

  await typeIntoEditor(page, 1, 'print("Привіт, файл!")');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(report).toHaveCount(0, { timeout: 15_000 });
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByText('Здача файлом hello_file.py, до 64 КБ')).toBeVisible();
});

test('file delivery turned on in the fix draft editor survives a save', async ({ page }) => {
  await openNewTaskForm(page);
  await page.getByLabel('Тип завдання').selectOption('fix');
  await page.getByLabel('Ідентифікатор (slug)').fill(`e2e-file-fix-${Date.now()}`);
  await page.getByLabel('Назва').fill('UI виправ файл');
  await page.getByLabel('Середовище').selectOption('console');
  await page.getByLabel('Умова').fill('Виправ програму.');
  await typeIntoEditor(page, 0, 'print("Привіт"');
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'stdout_equals', value: 'Привіт', trim: true }]));
  await createDraft(page);

  await expect(page.getByLabel(FILE_TOGGLE)).not.toBeChecked();
  await page.getByLabel(FILE_TOGGLE).check();
  await page.getByLabel('Назва файлу').fill('fix_me.py');
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'PATCH' && response.ok()),
    page.getByRole('button', { name: 'Зберегти' }).click()
  ]);

  await page.reload();
  await expect(page.getByLabel(FILE_TOGGLE)).toBeChecked();
  await expect(page.getByLabel('Назва файлу')).toHaveValue('fix_me.py');
});
