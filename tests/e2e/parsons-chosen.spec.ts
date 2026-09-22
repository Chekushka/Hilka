import { expect, test, type Page } from '@playwright/test';

/**
 * `parsons.indentMode: 'chosen'` (docs/TASK_SCHEMA.md) — every line starts
 * flat and the student sets each one's indent with the Indent/Outdent
 * buttons, graded by `order_equals`'s `checkIndent`/`indents`. Drives the
 * real authoring form (NewTaskForm) the same way
 * tests/e2e/predict-choice.spec.ts does for predict's choice mode, then
 * assigns the published task to a fresh session via the API and joins as a
 * student to prove ParsonsTaskView actually renders and grades the indent.
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

async function addLine(page: Page, text: string) {
  await page.locator('li', { hasText: text }).getByRole('button', { name: 'Додати ↓' }).click();
}

async function indentIn(page: Page, text: string, times = 1) {
  for (let i = 0; i < times; i += 1) {
    await page.locator('li', { hasText: text }).getByRole('button', { name: 'Відступ →' }).click();
  }
}

test('a teacher builds a chosen-indent parsons task, and a student grades it by setting each line\'s indent', async ({
  page
}) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const stamp = Date.now();
  const slug = `e2e-ui-parsons-chosen-${stamp}`;
  const taskTitle = `UI Parsons chosen ${stamp}`;

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('parsons');
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill(taskTitle);
  await page.getByLabel('Умова').fill('Склади програму й виستав відступи.');
  await page
    .getByLabel(/Рядки програми/)
    .fill('0:import turtle\n0:for i in range(3):\n1:turtle.forward(100)\n1:turtle.right(120)');

  await page.getByLabel('Відступи').selectOption('chosen');
  await page
    .getByLabel('Перевірки (JSON)')
    .fill(JSON.stringify([{ kind: 'order_equals', lines: [0, 1, 2, 3], checkIndent: true, indents: [0, 0, 1, 1] }]));

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  const taskId = page.url().split('/tasks/')[1];

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });

  const klass = await api(page, '/api/classes', {
    method: 'POST',
    body: { title: `E2E клас parsons ${stamp}`, roster: ['Олена'] }
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
  await expect(page.getByText('Склади програму й виستав відступи.')).toBeVisible();

  await addLine(page, 'import turtle');
  await addLine(page, 'for i in range(3):');
  await addLine(page, 'turtle.forward(100)');
  await addLine(page, 'turtle.right(120)');

  // Right order, wrong (flat) indent — must not pass yet.
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible();

  await indentIn(page, 'turtle.forward(100)');
  await indentIn(page, 'turtle.right(120)');

  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});
