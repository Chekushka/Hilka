import { expect, test, type Page } from '@playwright/test';

/**
 * `params` (docs/TASK_SCHEMA.md, "Parameterization") — a session-only
 * anti-copying mitigation (docs/AI_CONTEXT.md, "Cheating and Trust"):
 * `{name}` placeholders in a `code` task's prompt/starter/reference are
 * substituted server-side from `seed = hash(sessionId + studentName +
 * taskId)`, so the same student always sees the same variant and a
 * neighbour sees a different one. Seeded by
 * content/seed-tasks/grade7-code-turtle-star-variant.json, picked up
 * automatically by the demo session (scripts/db/seed-demo-session.ts
 * assigns every published task).
 */

const DEMO_CODE = 'demo01';
const TASK_TITLE = 'Зірка (своя сторона)';
const VALID_SIDES = ['60', '80', '100', '120'];

async function fetchTask(page: Page, taskId: string, student: string | null) {
  return page.evaluate(
    async ([code, id, name]) => {
      const url = name
        ? `/api/sessions/${code}/tasks/${id}?student=${encodeURIComponent(name as string)}`
        : `/api/sessions/${code}/tasks/${id}`;
      const response = await fetch(url);
      return { status: response.status, body: await response.json().catch(() => null) };
    },
    [DEMO_CODE, taskId, student] as const
  );
}

test('the same student sees the same variant every time, and an unlisted name is rejected', async ({ page }) => {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  const taskButton = page.getByRole('button', { name: TASK_TITLE });
  await expect(taskButton).toBeVisible();
  const taskId = await taskButton.getAttribute('data-task-id');
  expect(taskId).toBeTruthy();

  const first = await fetchTask(page, taskId!, 'Олена');
  expect(first.status).toBe(200);
  const firstPrompt = (first.body as { payload: { prompt: string } }).payload.prompt;
  const side = firstPrompt.match(/зі стороною (\d+)/)?.[1];
  expect(side).toBeDefined();
  expect(VALID_SIDES).toContain(side);
  expect(firstPrompt).not.toContain('{side}');
  expect((first.body as { params?: unknown }).params).toBeUndefined();

  const second = await fetchTask(page, taskId!, 'Олена');
  expect(second.status).toBe(200);
  expect((second.body as { payload: { prompt: string } }).payload.prompt).toBe(firstPrompt);
  expect((second.body as { reference: { code: string } }).reference.code).toBe(
    (first.body as { reference: { code: string } }).reference.code
  );

  const unlisted = await fetchTask(page, taskId!, 'Хтось Сторонній');
  expect(unlisted.status).toBe(400);

  const noStudent = await fetchTask(page, taskId!, null);
  expect(noStudent.status).toBe(400);
});

test('the rendered task shows a concrete side length, never the raw placeholder, and grades correctly', async ({
  page
}) => {
  await page.goto(`/s/${DEMO_CODE}`);
  await page.getByRole('button', { name: 'Тарас' }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();

  const promptText = await page.getByText(/Намалюй п'ятикутну зірку зі стороною/).textContent();
  expect(promptText).not.toContain('{side}');
  const side = promptText?.match(/зі стороною (\d+)/)?.[1];
  expect(side).toBeDefined();
  expect(VALID_SIDES).toContain(side);

  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.insertText(`import turtle\nfor i in range(5):\n    turtle.forward(${side})\n    turtle.right(144)`);
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 15_000 });
});
