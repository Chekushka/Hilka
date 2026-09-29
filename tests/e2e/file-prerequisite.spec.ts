import { expect, test, type Page } from '@playwright/test';

/**
 * The file-delivery sequencing rule (lib/task/prerequisite.ts) as students
 * and teachers meet it: a note on the file task pointing at its in-browser
 * prerequisite until that is passed — advice, never a lock — and a warning in
 * the session builder when a file task has nothing before it. Uses grade 8
 * lesson 43, where the IDLE task follows «Візитівка програми».
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const FILE_TASK = 'Перша програма в IDLE';
const PREREQUISITE = 'Візитівка програми';
const PREREQUISITE_SOLUTION = 'print("Мене звати Python")\nprint("Я виконую команди по черзі")';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function solvePrerequisite(page: Page) {
  await expect(page.getByRole('heading', { name: PREREQUISITE, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(PREREQUISITE_SOLUTION);
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
}

const note = (page: Page) => page.getByTestId('file-prerequisite');

test('in practice, a file task points at its prerequisite until it is passed, and stays usable', async ({ page }) => {
  await page.goto('/practice/g8-43-intro/g8-code-idle-hello');
  await expect(page.getByRole('heading', { name: FILE_TASK, exact: true })).toBeVisible();
  await expect(note(page)).toContainText(`«${PREREQUISITE}»`);
  // Advice, not a lock: the download is right there.
  await expect(page.getByRole('button', { name: /Завантажити файл/ })).toBeVisible();

  await note(page).getByRole('link', { name: `Відкрити «${PREREQUISITE}»` }).click();
  await solvePrerequisite(page);

  await page.goto('/practice/g8-43-intro/g8-code-idle-hello');
  await expect(page.getByRole('heading', { name: FILE_TASK, exact: true })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
});

test('an in-browser task never shows the note', async ({ page }) => {
  await page.goto('/practice/g8-43-intro/g8-code-print-card');
  await expect(page.getByRole('heading', { name: PREREQUISITE, exact: true })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
});

test('the session builder warns about a file task with nothing before it, and a session room shows the note', async ({
  page
}) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await expect(page.getByRole('heading', { name: 'Нове заняття' })).toBeVisible();
  const warning = page.getByTestId('file-unsequenced');

  // The IDLE task alone: warned about, but not blocked.
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Середовище програмування' });
  const fileItem = page.getByRole('listitem').filter({ has: page.getByText(FILE_TASK, { exact: true }) });
  await fileItem.getByRole('checkbox').check();
  await expect(warning).toContainText(FILE_TASK);

  // Its prerequisite ticked afterwards still comes later in the students' order.
  const prerequisiteItem = page.getByRole('listitem').filter({ has: page.getByText(PREREQUISITE, { exact: true }) });
  await prerequisiteItem.getByRole('checkbox').check();
  await expect(warning).toContainText(FILE_TASK);

  // In lesson order the warning goes away.
  await fileItem.getByRole('checkbox').uncheck();
  await prerequisiteItem.getByRole('checkbox').uncheck();
  await page.getByLabel('Додати урок цілком').selectOption({ label: "8 кл. · урок 43: Програма і транслятор (Обов'язковий)" });
  await page.getByRole('button', { name: 'Додати', exact: true }).click();
  await expect(page.getByText('обрано: 5')).toBeVisible();
  await expect(warning).toHaveCount(0);

  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  await page.getByRole('button', { name: FILE_TASK, exact: true }).click();
  await expect(note(page)).toContainText(`«${PREREQUISITE}»`);

  await note(page).getByRole('button', { name: `Відкрити «${PREREQUISITE}»` }).click();
  await solvePrerequisite(page);

  await page.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(`^${FILE_TASK}`) }).click();
  await expect(page.getByRole('heading', { name: FILE_TASK, exact: true })).toBeVisible();
  await expect(note(page)).toHaveCount(0);
});
