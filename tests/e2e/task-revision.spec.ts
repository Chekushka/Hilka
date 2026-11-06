import { expect, test, type Page } from '@playwright/test';
import type { RunResult } from '@/lib/runner';

/**
 * Editing a published task (lib/task/revision.ts, docs/TASKS.md "Editing a
 * published task"): a revision is opened, edited and published through the
 * same gate as a draft, and students see the live version until then.
 *
 * Same conventions as tests/e2e/task-authoring.spec.ts: API calls go through
 * in-page fetch, and pages are reached by link clicks rather than page.goto
 * (AI_CONTEXT.md Gotchas, "request.url ignores the Host header locally").
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

interface ApiResult {
  status: number;
  body: unknown;
}

interface TaskBody {
  status: string;
  version: number;
  title: string;
  payload: { prompt: string };
  checks: unknown[];
  reference: { code: string } | null;
  revision: { title: string; payload: { prompt: string } } | null;
}

async function loginAsTeacher(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(email);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function api(page: Page, path: string, init?: { method?: string; body?: unknown }): Promise<ApiResult> {
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

async function runInBrowser(page: Page, code: string): Promise<RunResult> {
  await page.goto('/runner');
  await page.waitForFunction(() => window.__runner__ !== undefined);
  return page.evaluate((source) => window.__runner__!.run(source, { mode: 'headless' }), code);
}

/** A published console task printing 7, at version 1. Leaves the page logged in. */
async function publishedTask(page: Page, title: string): Promise<string> {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug: `e2e-revision-${Date.now()}`,
      topicSlug: 'arithmetic',
      title,
      payload: { type: 'code', surface: 'console', prompt: 'Виведи сім.', starter: '' },
      checks: [{ kind: 'number_close', value: 7, tol: 0.01, which: 'last' }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };
  const run = await runInBrowser(page, 'print(7)');
  await loginAsTeacher(page, TEACHER_EMAIL);
  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: 'print(7)', run }
  });
  expect(published.status).toBe(200);
  return id;
}

test('a teacher edits a published task from its page; students keep the old version until publish', async ({
  page
}) => {
  const title = `Сімка ${Date.now()}`;
  const id = await publishedTask(page, title);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: title }).click();
  await expect(page.getByRole('heading', { name: 'Завдання', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Редагувати' }).click();
  await expect(page.getByRole('heading', { name: 'Редагування завдання' })).toBeVisible();
  await expect(page.getByText(/Учні й далі бачать версію 1/)).toBeVisible();

  // The reference editor opens on the live reference, not on the starter.
  await expect(page.locator('.cm-content').nth(1)).toHaveText('print(7)');

  await page.getByLabel('Умова').fill('Виведи одне число: сім. Тільки число, без слів.');
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith(`/api/tasks/${id}`) && response.request().method() === 'PATCH'),
    page.getByRole('button', { name: 'Зберегти', exact: true }).click()
  ]);

  // Saved into the revision; the live version — what students get — is untouched.
  const midway = (await api(page, `/api/tasks/${id}`)).body as TaskBody;
  expect(midway.version).toBe(1);
  expect(midway.payload.prompt).toBe('Виведи сім.');
  expect(midway.revision?.payload.prompt).toBe('Виведи одне число: сім. Тільки число, без слів.');

  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeEnabled({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 2.')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Учні вже бачать нову версію/)).toBeVisible();

  const after = (await api(page, `/api/tasks/${id}`)).body as TaskBody;
  expect(after.version).toBe(2);
  expect(after.payload.prompt).toBe('Виведи одне число: сім. Тільки число, без слів.');
  expect(after.revision).toBeNull();

  // Back on the task: published again, editable again.
  await page.getByRole('button', { name: 'Переглянути завдання' }).click();
  await expect(page.getByRole('button', { name: 'Редагувати' })).toBeVisible();
  await expect(page.getByText('Версія 2', { exact: true })).toBeVisible();
});

test('a revision is held to the publish gate, and discarding it leaves the live version as it was', async ({
  page
}) => {
  const id = await publishedTask(page, `Сімка-гейт ${Date.now()}`);

  // Not editable in place: a save with no revision open is refused.
  const direct = await api(page, `/api/tasks/${id}`, { method: 'PATCH', body: { title: 'Напряму' } });
  expect(direct.status).toBe(409);

  expect((await api(page, `/api/tasks/${id}/revision`, { method: 'POST' })).status).toBe(200);
  // Opening twice is harmless — the open one is kept.
  expect((await api(page, `/api/tasks/${id}/revision`, { method: 'POST' })).status).toBe(200);

  // The type is fixed for every later version.
  const retyped = await api(page, `/api/tasks/${id}`, {
    method: 'PATCH',
    body: { payload: { type: 'quiz', prompt: 'Що?', options: ['а', 'б'], multiple: false } }
  });
  expect(retyped.status).toBe(400);

  const saved = await api(page, `/api/tasks/${id}`, {
    method: 'PATCH',
    body: { title: 'Вісімка', checks: [{ kind: 'number_close', value: 8, tol: 0.01, which: 'last' }] }
  });
  expect(saved.status).toBe(200);

  // The old reference no longer passes the revision's checks: refused, live version untouched.
  const oldRun = await runInBrowser(page, 'print(7)');
  await loginAsTeacher(page, TEACHER_EMAIL);
  const refused = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: 'print(7)', run: oldRun }
  });
  expect(refused.status).toBe(422);
  expect((refused.body as { error: string }).error).toBe('reference_fails_checks');
  const live = (await api(page, `/api/tasks/${id}`)).body as TaskBody;
  expect(live.version).toBe(1);
  expect(live.title).not.toBe('Вісімка');
  expect(live.revision?.title).toBe('Вісімка');

  // Thrown away: nothing changed for students, and the task can be revised afresh.
  expect((await api(page, `/api/tasks/${id}/revision`, { method: 'DELETE' })).status).toBe(200);
  const discarded = (await api(page, `/api/tasks/${id}`)).body as TaskBody;
  expect(discarded.revision).toBeNull();
  expect(discarded.version).toBe(1);
  expect(discarded.checks).toEqual([{ kind: 'number_close', value: 7, tol: 0.01, which: 'last' }]);

  // A revision that passes publishes as the next version.
  await api(page, `/api/tasks/${id}/revision`, { method: 'POST' });
  await api(page, `/api/tasks/${id}`, {
    method: 'PATCH',
    body: { checks: [{ kind: 'number_close', value: 8, tol: 0.01, which: 'last' }] }
  });
  const newRun = await runInBrowser(page, 'print(8)');
  await loginAsTeacher(page, TEACHER_EMAIL);
  const accepted = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: 'print(8)', run: newRun }
  });
  expect(accepted.status).toBe(200);
  const next = accepted.body as TaskBody;
  expect(next.version).toBe(2);
  expect(next.reference?.code).toBe('print(8)');
  expect(next.revision).toBeNull();
});

test('a parameterized task says why it cannot be revised here, and offers no edit', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  await page.getByRole('link', { name: 'Завдання' }).click();
  // content/seed-tasks/grade7-code-turtle-star-variant.json carries `params`.
  await page.getByRole('link', { name: 'Зірка (своя сторона)' }).click();
  await expect(page.getByText(/свій варіант для кожного учня/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Редагувати' })).toHaveCount(0);
});
