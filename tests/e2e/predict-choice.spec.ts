import { expect, test, type Page } from '@playwright/test';

/**
 * `predict.answerMode: 'choice'` (docs/TASK_SCHEMA.md) — the student picks
 * which of several candidate outputs the shown code prints, instead of
 * typing it. Drives the real authoring forms (NewTaskForm, PredictDraftEditor)
 * the same way tests/e2e/task-authoring-ui.spec.ts does for text mode, then
 * assigns the published task to a fresh session via the API (already proven
 * by tests/e2e/session-builder.spec.ts through the UI) and joins as a
 * student to prove PredictTaskView actually renders and grades the choice.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function typeIntoEditor(page: Page, code: string) {
  const editor = page.locator('.cm-content').first();
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function api(page: Page, path: string, init?: { method?: string; body?: unknown }) {
  return page.evaluate(
    async ([p, method, body]) => {
      const response = await fetch(p as string, {
        method: (method as string | undefined) ?? 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    [path, init?.method, init?.body] as const
  );
}

test('a teacher builds a choice-mode predict task, and a student grades it by picking an option', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const stamp = Date.now();
  const slug = `e2e-ui-predict-choice-${stamp}`;
  const taskTitle = `UI Predict choice ${stamp}`;

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('predict');
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill(taskTitle);
  await page.getByLabel('Умова').fill('Що виведе ця програма?');
  await typeIntoEditor(page, 'a = 2\nb = 3\nprint(a + b * 4)');

  await page.getByLabel('Формат відповіді').selectOption('choice');
  await page.getByLabel(/Варіанти відповіді/).fill('20\n14\n8');
  // index 1 ("14") is the real output of a + b * 4.
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'choice_equals', indices: [1] }]));
  await page.getByLabel(/Складність/).fill('1');

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  const taskId = page.url().split('/tasks/')[1];

  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByText('14', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });

  const klass = await api(page, '/api/classes', {
    method: 'POST',
    body: { title: `E2E клас ${stamp}`, roster: ['Олена'] }
  });
  expect(klass.status).toBe(201);
  const { id: classId } = klass.body as { id: string };

  const session = await api(page, '/api/sessions', {
    method: 'POST',
    body: { classId, mode: 'practice', taskIds: [taskId], timeLimitS: null, hintsEnabled: true, shuffle: false }
  });
  expect(session.status).toBe(201);
  const { code } = session.body as { code: string };

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  await page.getByRole('button', { name: taskTitle }).click();
  await expect(page.getByText('a = 2')).toBeVisible();

  // Radios render, not a text field — the whole point of choice mode.
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.locator('input[type=text], input#predict-answer')).toHaveCount(0);

  await page.getByRole('radio').nth(0).check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();

  await page.getByRole('radio').nth(1).check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});
