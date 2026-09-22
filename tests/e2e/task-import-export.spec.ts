import { expect, test, type Page } from '@playwright/test';

/**
 * JSON export/import of the whole task catalog (docs/TASKS.md, "JSON
 * export/import of all tasks"). Same in-page-fetch pattern as
 * tests/e2e/task-authoring.spec.ts, for the same reason — the login
 * redirect's origin does not always match playwright.config.ts's baseURL
 * (docs/AI_CONTEXT.md Gotchas).
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

interface ContentBundle {
  topics: { slug: string }[];
  tasks: { slug: string; topicSlug: string; status: string; version: number }[];
}

test('exporting requires a logged-in teacher', async ({ page }) => {
  await page.goto('/');
  const response = await api(page, '/api/tasks/export');
  expect(response.status).toBe(401);
});

test('importing requires a logged-in teacher', async ({ page }) => {
  await page.goto('/');
  const response = await api(page, '/api/tasks/import', { method: 'POST', body: { topics: [], tasks: [] } });
  expect(response.status).toBe(401);
});

test('export returns every topic and task, including drafts', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const slug = `e2e-export-draft-${Date.now()}`;
  const created = await api(page, '/api/tasks', {
    method: 'POST',
    body: {
      slug,
      topicSlug: 'turtle-basics',
      title: 'E2E чернетка для експорту',
      payload: { type: 'code', surface: 'console', prompt: 'Тест', starter: '' },
      checks: []
    }
  });
  expect(created.status).toBe(201);

  const exported = await api(page, '/api/tasks/export');
  expect(exported.status).toBe(200);
  const bundle = exported.body as ContentBundle;
  expect(bundle.topics.some((topic) => topic.slug === 'turtle-basics')).toBe(true);
  const exportedTask = bundle.tasks.find((task) => task.slug === slug);
  expect(exportedTask).toBeDefined();
  expect(exportedTask?.status).toBe('draft');
});

test('import creates a new topic and task by slug, referenced by an export afterwards', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const stamp = Date.now();
  const topicSlug = `e2e-import-topic-${stamp}`;
  const taskSlug = `e2e-import-quiz-${stamp}`;

  const imported = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: {
      topics: [{ slug: topicSlug, title: 'E2E імпортована тема', order: 999, gradeTags: [7] }],
      tasks: [
        {
          slug: taskSlug,
          topicSlug,
          type: 'quiz',
          title: 'E2E імпортоване завдання',
          payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
          checks: [{ kind: 'choice_equals', indices: [0] }],
          hints: [],
          difficulty: 1,
          gradeTags: [7],
          version: 1,
          status: 'published'
        }
      ]
    }
  });
  expect(imported.status).toBe(200);
  expect(imported.body).toEqual({ topicsImported: 1, tasksImported: 1 });

  const exported = await api(page, '/api/tasks/export');
  const bundle = exported.body as ContentBundle;
  expect(bundle.topics.some((topic) => topic.slug === topicSlug)).toBe(true);
  const importedTask = bundle.tasks.find((task) => task.slug === taskSlug);
  expect(importedTask).toBeDefined();
  expect(importedTask?.topicSlug).toBe(topicSlug);
  expect(importedTask?.status).toBe('published');

  // Re-importing the exact same bundle upserts rather than duplicating —
  // the counts stay the same, not doubled.
  const reimported = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: {
      topics: [{ slug: topicSlug, title: 'E2E імпортована тема', order: 999, gradeTags: [7] }],
      tasks: [
        {
          slug: taskSlug,
          topicSlug,
          type: 'quiz',
          title: 'E2E імпортоване завдання (оновлено)',
          payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
          checks: [{ kind: 'choice_equals', indices: [0] }],
          hints: [],
          difficulty: 1,
          gradeTags: [7],
          version: 1,
          status: 'published'
        }
      ]
    }
  });
  expect(reimported.status).toBe(200);
  expect(reimported.body).toEqual({ topicsImported: 1, tasksImported: 1 });

  const reexported = await api(page, '/api/tasks/export');
  const reexportedBundle = reexported.body as { tasks: { slug: string; title: string }[] };
  const matches = reexportedBundle.tasks.filter((task) => task.slug === taskSlug);
  expect(matches).toHaveLength(1);
  expect(matches[0].title).toBe('E2E імпортоване завдання (оновлено)');
});

test('import accepts a task whose topic is not in the bundle, as long as it already exists', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const taskSlug = `e2e-import-existing-topic-${Date.now()}`;
  const imported = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: {
      topics: [],
      tasks: [
        {
          slug: taskSlug,
          topicSlug: 'variables',
          type: 'quiz',
          title: 'E2E завдання без нової теми',
          payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
          checks: [{ kind: 'choice_equals', indices: [0] }],
          hints: [],
          difficulty: 1,
          gradeTags: [7],
          version: 1,
          status: 'draft'
        }
      ]
    }
  });
  expect(imported.status).toBe(200);
  expect(imported.body).toEqual({ topicsImported: 0, tasksImported: 1 });
});

test('import is rejected wholesale when a task references an unknown topic', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const response = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: {
      topics: [],
      tasks: [
        {
          slug: `e2e-import-unknown-topic-${Date.now()}`,
          topicSlug: 'not-a-real-topic',
          type: 'quiz',
          title: 'Без теми',
          payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
          checks: [{ kind: 'choice_equals', indices: [0] }],
          hints: [],
          difficulty: 1,
          gradeTags: [7],
          version: 1,
          status: 'draft'
        }
      ]
    }
  });
  expect(response.status).toBe(400);
  expect((response.body as { error: string }).error).toBe('invalid_content');
});

test('import is rejected wholesale when a task fails checker validation', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  const response = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: {
      topics: [],
      tasks: [
        {
          slug: `e2e-import-bad-checks-${Date.now()}`,
          topicSlug: 'variables',
          type: 'quiz',
          title: 'Погані перевірки',
          payload: { type: 'quiz', prompt: 'Що?', options: ['так', 'ні'], multiple: false },
          // uses/forbids require a non-empty rule list — this one is empty on purpose.
          checks: [{ kind: 'uses', any: [] }],
          hints: [],
          difficulty: 1,
          gradeTags: [7],
          version: 1,
          status: 'draft'
        }
      ]
    }
  });
  expect(response.status).toBe(400);
  expect((response.body as { error: string }).error).toBe('invalid_content');
});

test('a malformed body is rejected before touching the database', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const response = await api(page, '/api/tasks/import', { method: 'POST', body: { topics: 'nope', tasks: [] } });
  expect(response.status).toBe(400);
  expect((response.body as { error: string }).error).toBe('invalid_body');
});
