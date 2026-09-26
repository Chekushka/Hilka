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
  lessons: LessonExport[];
}

interface LessonExport {
  slug: string;
  grade: number;
  order: number;
  kind: string;
  title: string;
  curriculumRef?: string;
  explanationMd: string;
  coreTaskSlugs: string[];
  additionalTaskSlugs: string[];
}

/** A grade 7 lesson far past the seeded 25–42, so it never collides with them or with a parallel run. */
function testLesson(stamp: number, overrides: Partial<LessonExport> = {}): LessonExport {
  return {
    slug: `e2e-import-lesson-${stamp}`,
    grade: 7,
    order: 500 + (stamp % 400),
    kind: 'practice',
    title: `Імпортований урок ${stamp}`,
    explanationMd: '# Імпорт\n\nПояснення з файлу.',
    coreTaskSlugs: ['g7-quiz-print-purpose'],
    additionalTaskSlugs: [],
    ...overrides
  };
}

/**
 * page.goto with a relative path targets playwright.config.ts's baseURL, which
 * can differ from the origin the login cookie was set on (docs/AI_CONTEXT.md
 * Gotchas) — resolve against where the page actually is instead.
 */
async function goSameOrigin(page: Page, path: string) {
  await page.goto(new URL(path, page.url()).toString());
}

/** Lessons created here are removed again, so /practice looks the same to every other spec. */
async function deleteLessonByTitle(page: Page, title: string) {
  await goSameOrigin(page, '/lessons');
  const href = await page.getByRole('link', { name: title, exact: true }).getAttribute('href');
  const id = href?.split('/').pop();
  if (!id) throw new Error(`lesson "${title}" is not listed`);
  const response = await api(page, `/api/lessons/${id}`, { method: 'DELETE' });
  expect(response.status).toBe(204);
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
  expect(imported.body).toEqual({ topicsImported: 1, tasksImported: 1, lessonsImported: 0 });

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
  expect(reimported.body).toEqual({ topicsImported: 1, tasksImported: 1, lessonsImported: 0 });

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
  expect(imported.body).toEqual({ topicsImported: 0, tasksImported: 1, lessonsImported: 0 });
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

test('export includes every lesson, with tasks by slug and the explanation inline', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const bundle = (await api(page, '/api/tasks/export')).body as ContentBundle;

  const intro = bundle.lessons.find((lesson) => lesson.slug === 'g7-25-intro');
  expect(intro).toMatchObject({ grade: 7, order: 25, kind: 'mandatory', title: 'Перша програма' });
  expect(intro?.coreTaskSlugs).toContain('g7-quiz-print-purpose');
  expect(intro?.explanationMd.length).toBeGreaterThan(0);
  // Every task a lesson names is in the same bundle, so the file imports on its own.
  const taskSlugs = new Set(bundle.tasks.map((task) => task.slug));
  for (const lesson of bundle.lessons) {
    for (const slug of [...lesson.coreTaskSlugs, ...lesson.additionalTaskSlugs]) expect(taskSlugs.has(slug)).toBe(true);
  }
});

test('an imported lesson reaches students, re-importing updates it, and an export round-trips it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const stamp = Date.now();
  const lesson = testLesson(stamp, { additionalTaskSlugs: ['g7-code-rectangle-perimeter'] });

  const imported = await api(page, '/api/tasks/import', { method: 'POST', body: { topics: [], tasks: [], lessons: [lesson] } });
  expect(imported.status).toBe(200);
  expect(imported.body).toEqual({ topicsImported: 0, tasksImported: 0, lessonsImported: 1 });

  await goSameOrigin(page, `/practice/${lesson.slug}`);
  await expect(page.getByRole('heading', { name: lesson.title, level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Імпорт', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Навіщо потрібна функція print\(\)/ })).toBeVisible();

  // Same slug: an update, not a second lesson.
  const renamed = { ...lesson, title: `${lesson.title} (оновлено)` };
  const reimported = await api(page, '/api/tasks/import', { method: 'POST', body: { topics: [], tasks: [], lessons: [renamed] } });
  expect(reimported.status).toBe(200);

  const bundle = (await api(page, '/api/tasks/export')).body as ContentBundle;
  const matches = bundle.lessons.filter((candidate) => candidate.slug === lesson.slug);
  expect(matches).toEqual([renamed]);

  await deleteLessonByTitle(page, renamed.title);
});

test('an old bundle without lessons still imports', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const response = await api(page, '/api/tasks/import', { method: 'POST', body: { topics: [], tasks: [] } });
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ topicsImported: 0, tasksImported: 0, lessonsImported: 0 });
});

test('a lesson naming an unknown task, or a number another lesson holds, rejects the whole import', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const stamp = Date.now();

  const unknownTask = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: { topics: [], tasks: [], lessons: [testLesson(stamp, { coreTaskSlugs: ['not-a-real-task'] })] }
  });
  expect(unknownTask.status).toBe(400);
  expect(unknownTask.body).toMatchObject({
    error: 'invalid_content',
    issues: [{ lessonSlug: `e2e-import-lesson-${stamp}`, message: 'unknown task "not-a-real-task"' }]
  });

  // Grade 7 lesson 25 is the seeded «Перша програма», under another slug.
  const clash = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: { topics: [], tasks: [], lessons: [testLesson(stamp, { order: 25 })] }
  });
  expect(clash.status).toBe(400);
  expect((clash.body as { issues: { message: string }[] }).issues[0].message).toBe(
    'order 25 in grade 7 is already used by lesson "g7-25-intro"'
  );

  // Nothing was written by either attempt.
  const bundle = (await api(page, '/api/tasks/export')).body as ContentBundle;
  expect(bundle.lessons.some((lesson) => lesson.slug === `e2e-import-lesson-${stamp}`)).toBe(false);
});

test('a malformed lesson is rejected before touching the database', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);
  const response = await api(page, '/api/tasks/import', {
    method: 'POST',
    body: { topics: [], tasks: [], lessons: [{ slug: 'x', grade: '7' }] }
  });
  expect(response.status).toBe(400);
  expect((response.body as { error: string }).error).toBe('invalid_body');
});
