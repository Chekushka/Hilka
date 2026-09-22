import { expect, test, type Page } from '@playwright/test';
import type { RunResult } from '@/lib/runner';

/**
 * The draft/publish flow, end to end, without any form UI (docs/TASKS.md,
 * "Draft / publish + version bump" — that UI is separate, unbuilt work).
 * There is no server-side Python execution (docs/AI_CONTEXT.md), so the
 * reference solution runs in the browser via /runner, exactly like a future
 * authoring UI would, and the computed run is posted to the publish route.
 *
 * API calls go through in-page fetch, not page.request: the login redirect
 * lands the browser on whatever origin the server's own absolute-URL
 * construction picks (docs/AI_CONTEXT.md Gotchas — "request.url ignores the
 * Host header locally"), which is not always playwright.config.ts's baseURL.
 * page.request always targets that config baseURL regardless of where the
 * page actually navigated, so it would miss the teacher cookie; an in-page
 * fetch always matches the page's real current origin, the same way the
 * student flow's own /api/attempts calls do.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

interface ApiResult {
  status: number;
  body: unknown;
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

test('a teacher drafts a task, runs the reference in-browser, and publishes it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-draft-${Date.now()}`;
  const referenceCode = 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-basics',
      title: 'E2E чернетка',
      payload: { type: 'code', surface: 'turtle', prompt: 'Тест', starter: '' },
      checks: [
        { kind: 'shape_props', closed: true, segmentCount: 4 },
        { kind: 'shape_equals', normalize: ['translate', 'rotate'] }
      ]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const unpublished = await api(page, `/api/tasks/${id}`);
  expect((unpublished.body as { status: string }).status).toBe('draft');

  // Following /runner navigates away from the logged-in page; log back in —
  // the teacher cookie survives navigation, this just re-establishes it here
  // since /runner itself needs no auth and doesn't preserve the earlier page.
  const run = await runInBrowser(page, referenceCode);
  expect(run.error).toBeNull();
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode, run }
  });
  expect(published.status).toBe(200);
  const publishedTask = published.body as {
    status: string;
    version: number;
    reference: { code: string; artifacts: { drawing: unknown[] } };
  };
  expect(publishedTask.status).toBe('published');
  expect(publishedTask.version).toBe(1);
  expect(publishedTask.reference.code).toBe(referenceCode);
  expect(publishedTask.reference.artifacts.drawing).toHaveLength(4);

  // A second publish attempt is rejected — the gate is one-way per version.
  const republish = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode, run }
  });
  expect(republish.status).toBe(409);
});

test('a predict task publishes once its checks match what payload.code actually prints', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-predict-${Date.now()}`;
  const code = 'a = 2\nb = 3\nprint(a + b * 4)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'arithmetic',
      title: 'E2E предикт чернетка',
      payload: { type: 'predict', prompt: 'Тест', code, answerMode: 'text' },
      checks: [{ kind: 'text_equals', value: '14', normalize: 'trim' }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  // payload.code IS the reference here — there is nothing separate to write.
  const run = await runInBrowser(page, code);
  expect(run.error).toBeNull();
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: code, run }
  });
  expect(published.status).toBe(200);
  const publishedTask = published.body as { status: string; version: number; reference: { code: string } };
  expect(publishedTask.status).toBe('published');
  expect(publishedTask.version).toBe(1);
  expect(publishedTask.reference.code).toBe(code);
});

test('a predict task is rejected when its checks do not match what the code prints', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-predict-wrong-${Date.now()}`;
  const code = 'a = 2\nb = 3\nprint(a + b * 4)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'arithmetic',
      title: 'E2E предикт (хибна перевірка)',
      payload: { type: 'predict', prompt: 'Тест', code, answerMode: 'text' },
      // The code actually prints 14, not 20 — this must not publish.
      checks: [{ kind: 'text_equals', value: '20', normalize: 'trim' }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, code);
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: code, run }
  });
  expect(published.status).toBe(422);
  expect((published.body as { error: string }).error).toBe('reference_fails_checks');
});

test('a choice-mode predict task publishes once the chosen option matches what the code prints', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-predict-choice-${Date.now()}`;
  const code = 'a = 2\nb = 3\nprint(a + b * 4)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'arithmetic',
      title: 'E2E предикт choice',
      payload: { type: 'predict', prompt: 'Тест', code, answerMode: 'choice', options: ['20', '14', '8'] },
      checks: [{ kind: 'choice_equals', indices: [1] }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, code);
  expect(run.error).toBeNull();
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: code, run }
  });
  expect(published.status).toBe(200);
  const publishedTask = published.body as { status: string; version: number };
  expect(publishedTask.status).toBe('published');
  expect(publishedTask.version).toBe(1);
});

test('a choice-mode predict task is rejected when the chosen option does not match what the code prints', async ({
  page
}) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-predict-choice-wrong-${Date.now()}`;
  const code = 'a = 2\nb = 3\nprint(a + b * 4)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'arithmetic',
      title: 'E2E предикт choice (хибний варіант)',
      payload: { type: 'predict', prompt: 'Тест', code, answerMode: 'choice', options: ['20', '14', '8'] },
      // The code actually prints 14 (index 1), not 20 (index 0) — must not publish.
      checks: [{ kind: 'choice_equals', indices: [0] }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, code);
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: code, run }
  });
  expect(published.status).toBe(422);
  expect((published.body as { error: string }).error).toBe('reference_fails_checks');
});

test('a choice-mode predict task with a malformed choice_equals is rejected before any run counts', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-predict-choice-malformed-${Date.now()}`;
  const code = 'a = 2\nb = 3\nprint(a + b * 4)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'arithmetic',
      title: 'E2E предикт choice (два варіанти)',
      payload: { type: 'predict', prompt: 'Тест', code, answerMode: 'choice', options: ['20', '14', '8'] },
      // A prediction has exactly one real output — more than one index is an authoring mistake.
      checks: [{ kind: 'choice_equals', indices: [0, 1] }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, code);
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: code, run }
  });
  expect(published.status).toBe(422);
  expect((published.body as { error: string }).error).toBe('reference_fails_checks');
});

test('a chosen-indent parsons task publishes once checkIndent matches payload.lines\' own indent', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-parsons-chosen-${Date.now()}`;
  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-loops',
      title: 'E2E parsons chosen',
      payload: {
        type: 'parsons',
        prompt: 'Тест',
        indentMode: 'chosen',
        lines: [
          { text: 'import turtle', indent: 0 },
          { text: 'for i in range(3):', indent: 0 },
          { text: 'turtle.forward(100)', indent: 1 },
          { text: 'turtle.right(120)', indent: 1 }
        ]
      },
      checks: [{ kind: 'order_equals', lines: [0, 1, 2, 3], checkIndent: true, indents: [0, 0, 1, 1] }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const published = await api(page, `/api/tasks/${id}/publish`, { method: 'POST' });
  expect(published.status).toBe(200);
  expect((published.body as { status: string }).status).toBe('published');
});

test('a chosen-indent parsons task is rejected when checkIndent\'s indents do not match the lines\' own indent', async ({
  page
}) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-parsons-chosen-wrong-${Date.now()}`;
  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-loops',
      title: 'E2E parsons chosen (хибні відступи)',
      payload: {
        type: 'parsons',
        prompt: 'Тест',
        indentMode: 'chosen',
        lines: [
          { text: 'import turtle', indent: 0 },
          { text: 'for i in range(3):', indent: 0 },
          { text: 'turtle.forward(100)', indent: 1 },
          { text: 'turtle.right(120)', indent: 1 }
        ]
      },
      // The real answer has the last two lines indented — this says none are.
      checks: [{ kind: 'order_equals', lines: [0, 1, 2, 3], checkIndent: true, indents: [0, 0, 0, 0] }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const published = await api(page, `/api/tasks/${id}/publish`, { method: 'POST' });
  expect(published.status).toBe(422);
  expect((published.body as { error: string }).error).toBe('reference_fails_checks');
});

test('a fix task publishes once the reference passes and the broken code fails', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-fix-${Date.now()}`;
  const broken = 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(80)';
  const referenceCode = 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'debugging',
      title: 'E2E fix чернетка',
      payload: { type: 'fix', surface: 'turtle', prompt: 'Тест', broken },
      checks: [{ kind: 'shape_props', closed: true, segmentCount: 4 }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, referenceCode);
  expect(run.error).toBeNull();
  const brokenRun = await runInBrowser(page, broken);
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode, run, brokenRun }
  });
  expect(published.status).toBe(200);
  const publishedTask = published.body as { status: string; version: number; reference: { code: string } };
  expect(publishedTask.status).toBe('published');
  expect(publishedTask.version).toBe(1);
  expect(publishedTask.reference.code).toBe(referenceCode);
});

test('a fix task is rejected when the broken code already passes every check', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-fix-not-broken-${Date.now()}`;
  // Not actually broken — right(90) draws a correct square, so this must not publish.
  const notReallyBroken = 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)';
  const referenceCode = notReallyBroken;

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'debugging',
      title: 'E2E fix (не насправді зламаний)',
      payload: { type: 'fix', surface: 'turtle', prompt: 'Тест', broken: notReallyBroken },
      checks: [{ kind: 'shape_props', closed: true, segmentCount: 4 }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, referenceCode);
  const brokenRun = await runInBrowser(page, notReallyBroken);
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode, run, brokenRun }
  });
  expect(published.status).toBe(422);
  expect((published.body as { error: string }).error).toBe('broken_passes_checks');
});

test('a fill task publishes with a separately written reference, unrelated to the template', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-fill-${Date.now()}`;
  const template = 'import turtle\nfor i in range({{1}}):\n    turtle.forward({{2}})\n    turtle.right({{3}})';
  const referenceCode = 'import turtle\nfor i in range(5):\n    turtle.forward(80)\n    turtle.right(72)';

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-loops',
      title: 'E2E fill чернетка',
      payload: { type: 'fill', prompt: 'Тест', template },
      checks: [{ kind: 'shape_props', closed: true, segmentCount: 5 }]
    }
  });
  expect(created.status).toBe(201);
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, referenceCode);
  expect(run.error).toBeNull();
  await loginAsTeacher(page, TEACHER_EMAIL);

  const published = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode, run }
  });
  expect(published.status).toBe(200);
  const publishedTask = published.body as { status: string; version: number; reference: { code: string } };
  expect(publishedTask.status).toBe('published');
  expect(publishedTask.version).toBe(1);
  expect(publishedTask.reference.code).toBe(referenceCode);
});

test('a fill task with no gap in its template is rejected before it is even created', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug: `e2e-fill-no-gap-${Date.now()}`,
      topicSlug: 'turtle-loops',
      title: 'E2E fill без пропусків',
      // No {{n}} anywhere — this is just a code task wearing a fill costume.
      payload: { type: 'fill', prompt: 'Тест', template: 'print(1)' },
      checks: []
    }
  });
  expect(created.status).toBe(400);
});

test('publish is rejected when the reference solution fails its own checks', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-draft-bad-${Date.now()}`;
  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-basics',
      title: 'E2E погана чернетка',
      payload: { type: 'code', surface: 'console', prompt: 'Тест', starter: '' },
      checks: [{ kind: 'last_line_equals', value: '42', message: 'Очікували 42' }]
    }
  });
  const { id } = created.body as { id: string };

  const run = await runInBrowser(page, 'print(41)');
  expect(run.error).toBeNull();
  await loginAsTeacher(page, TEACHER_EMAIL);

  const publishResponse = await api(page, `/api/tasks/${id}/publish`, {
    method: 'POST',
    body: { referenceCode: 'print(41)', run }
  });
  expect(publishResponse.status).toBe(422);
  const body = publishResponse.body as { error: string; failures: string[] };
  expect(body.error).toBe('reference_fails_checks');
  expect(body.failures).toEqual(['Очікували 42']);

  // Nothing was published — the row is still an editable draft.
  const stillDraft = await api(page, `/api/tasks/${id}`);
  expect((stillDraft.body as { status: string }).status).toBe('draft');
});

test('an unknown topic slug is rejected rather than silently orphaning the task', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const response = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug: `e2e-no-topic-${Date.now()}`,
      topicSlug: 'not-a-real-topic',
      title: 'Без теми',
      payload: { type: 'code', surface: 'console', prompt: 'Тест', starter: '' },
      checks: []
    }
  });
  expect(response.status).toBe(400);
  expect((response.body as { error: string }).error).toBe('unknown_topic');
});

test('task authoring endpoints require a logged-in teacher', async ({ page }) => {
  await page.goto('/');
  const response = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug: `e2e-unauth-${Date.now()}`,
      topicSlug: 'turtle-basics',
      title: 'Без входу',
      payload: { type: 'code', surface: 'console', prompt: 'Тест', starter: '' },
      checks: []
    }
  });
  expect(response.status).toBe(401);
});
