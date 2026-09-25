import { expect, test, type Page } from '@playwright/test';

/**
 * The authoring forms themselves (docs/TASKS.md, "Task authoring UI"), on
 * top of the API proven by tests/e2e/task-authoring.spec.ts: a teacher fills
 * in a new `code` task, saves it, writes a reference solution, runs it in
 * the browser, and publishes — driven through the real pages, not fetch.
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

async function typeIntoEditor(page: Page, nth: number, code: string) {
  const editor = page.locator('.cm-content').nth(nth);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('a teacher builds a turtle task from the forms and publishes it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  // Real link clicks, not page.goto: the login redirect can land the browser
  // on an origin that differs from playwright.config.ts's baseURL (see
  // AI_CONTEXT.md Gotchas, "request.url ignores the Host header locally"),
  // and page.goto always targets that configured baseURL for a relative
  // path regardless of where the page actually is — an in-app link click
  // stays on the page's real current origin instead, same as a real teacher.
  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  const slug = `e2e-ui-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI чернетка');
  await page.getByLabel('Середовище').selectOption('turtle');
  await page.getByLabel('Умова').fill('Намалюй квадрат зі стороною 60.');
  await typeIntoEditor(page, 0, 'import turtle\n');
  await page.getByLabel('Перевірки (JSON)').fill(
    JSON.stringify([
      { kind: 'shape_props', closed: true, segmentCount: 4 },
      { kind: 'shape_equals', normalize: ['translate', 'rotate'] }
    ])
  );
  await page.getByLabel(/Підказки/).fill('Спробуй цикл for i in range(4).');
  await page.getByLabel(/Складність/).fill('2');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  // Redirected to the task's own page, where the reference is written.
  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI чернетка')).toBeVisible();

  // The starter code carried over from the first form (editor 0 here is the
  // "starter" field on this page; the reference editor is the second one).
  await typeIntoEditor(page, 1, 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)');

  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('img', { name: 'Твій малюнок' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher builds a parsons task from the forms and publishes it with no run step', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('parsons');

  const slug = `e2e-ui-parsons-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Parsons чернетка');
  await page.getByLabel('Умова').fill('Розстав рядки так, щоб програма намалювала трикутник.');
  // The default lines pre-filled by NewTaskForm are already this triangle
  // (import → for → forward → right), so only the check needs writing.
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'order_equals', lines: [0, 1, 2, 3] }]));
  await page.getByLabel(/Підказки/).fill('Цикл повторюється тричі.');
  await page.getByLabel(/Складність/).fill('1');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI Parsons чернетка')).toBeVisible();

  // Nothing to run first — the payload's own line order already is correct
  // (lib/task/parsons.ts), so Publish alone is the gate.
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher builds a quiz task from the forms and publishes it with no run step', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('quiz');

  const slug = `e2e-ui-quiz-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Quiz чернетка');
  await page.getByLabel('Умова').fill('Яке з цих чисел найбільше?');
  await page.getByLabel('Варіанти відповіді (один на рядок)').fill('1\n2\n3');
  // Index 2 ("3") is the correct, largest option.
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'choice_equals', indices: [2] }]));
  await page.getByLabel(/Підказки/).fill('Порівняй усі три числа.');
  await page.getByLabel(/Складність/).fill('1');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI Quiz чернетка')).toBeVisible();

  // Nothing to run first — the correct answer lives entirely in `checks`
  // (lib/task/quiz.ts), so Publish alone is the gate.
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher builds a predict task from the forms, runs it, and publishes it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('predict');

  const slug = `e2e-ui-predict-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Predict чернетка');
  await page.getByLabel('Умова').fill('Що виведе ця програма?');
  await typeIntoEditor(page, 0, 'a = 2\nb = 3\nprint(a + b * 4)');
  await page
    .getByLabel('Перевірки (JSON)')
    .fill(JSON.stringify([{ kind: 'text_equals', value: '14', normalize: 'trim' }]));
  await page.getByLabel(/Підказки/).fill('Множення виконується раніше за додавання.');
  await page.getByLabel(/Складність/).fill('1');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI Predict чернетка')).toBeVisible();

  // Unlike `code`, there is no separate starter vs reference: the code field
  // saved above is already what runs (lib/task/types.ts) — Run just proves it.
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByText('14', { exact: true })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher builds a fix task from the forms, runs both programs, and publishes it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('fix');
  await page.getByLabel('Середовище').selectOption('turtle');

  const slug = `e2e-ui-fix-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Fix чернетка');
  await page.getByLabel('Умова').fill('У цій програмі помилка. Виправ її.');
  await typeIntoEditor(page, 0, 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(80)');
  await page
    .getByLabel('Перевірки (JSON)')
    .fill(JSON.stringify([{ kind: 'shape_props', closed: true, segmentCount: 4 }]));
  await page.getByLabel(/Підказки/).fill('Перевір кут повороту.');
  await page.getByLabel(/Складність/).fill('2');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI Fix чернетка')).toBeVisible();

  // Editor 0 is `broken` (already saved from the form above); editor 1 is
  // the separate, correct reference solution this page still needs written.
  await typeIntoEditor(page, 1, 'import turtle\nfor i in range(4):\n    turtle.forward(60)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('img', { name: 'Твій малюнок' })).toBeVisible({ timeout: 15_000 });

  // Broken must fail — proving it does is what unlocks Publish.
  await page.getByRole('button', { name: 'Запустити хибний код' }).click();
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeEnabled({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher builds a fill task from the forms, writes a reference, and publishes it', async ({ page }) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Тип завдання').selectOption('fill');

  const slug = `e2e-ui-fill-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Fill чернетка');
  await page.getByLabel('Умова').fill("Заповни пропуски, щоб намалювати п'ятикутник.");
  // A plain textarea, not a CodeEditor — {{n}} is not valid Python.
  await page
    .getByLabel('Шаблон коду з пропусками')
    .fill('import turtle\nfor i in range({{1}}):\n    turtle.forward({{2}})\n    turtle.right({{3}})');
  await page
    .getByLabel('Перевірки (JSON)')
    .fill(JSON.stringify([{ kind: 'shape_props', closed: true, segmentCount: 5 }]));
  await page.getByLabel(/Підказки/).fill('Сума поворотів дорівнює 360°.');
  await page.getByLabel(/Складність/).fill('3');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByText('UI Fill чернетка')).toBeVisible();

  // The reference is a separately written, fully correct program — it need
  // not even share the template's exact gap structure, same as code's
  // starter vs reference.
  await typeIntoEditor(page, 0, 'import turtle\nfor i in range(5):\n    turtle.forward(80)\n    turtle.right(72)');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('img', { name: 'Твій малюнок' })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a teacher adds cases to a console code task, and a hidden case blocks publish until the reference actually solves it', async ({
  page
}) => {
  await loginAsTeacher(page, TEACHER_EMAIL);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await expect(page.getByRole('heading', { name: 'Нове завдання' })).toBeVisible();

  await page.getByLabel('Середовище').selectOption('console');

  const slug = `e2e-ui-cases-${Date.now()}`;
  await page.getByLabel('Ідентифікатор (slug)').fill(slug);
  await page.getByLabel('Назва').fill('UI Периметр');
  await page.getByLabel('Умова').fill('Прочитай довжину і ширину прямокутника, виведи периметр.');
  // Task-level checks stay empty; every case carries its own — the same
  // shape content/seed-tasks/grade7-code-rectangle-perimeter.json uses.
  await page.getByLabel(/Тестові випадки/).fill(
    JSON.stringify([
      {
        label: 'звичайний випадок',
        stdin: ['5', '3'],
        checks: [{ kind: 'number_close', value: 16, tol: 0.01, which: 'last' }]
      },
      {
        label: 'більший прямокутник',
        stdin: ['10', '4'],
        hidden: true,
        checks: [{ kind: 'number_close', value: 28, tol: 0.01, which: 'last' }]
      }
    ])
  );
  await page.getByLabel(/Складність/).fill('2');

  await Promise.all([
    page.waitForResponse(
      (response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);

  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();

  // Editor 0 is `starter` (the save form above); editor 1 is the reference
  // run section below — same indexing as the turtle/fill tests.
  // A reference hardcoded to the visible case's expected number passes it,
  // but the hidden case's different expected number catches it — exactly
  // why cases exist.
  await typeIntoEditor(page, 1, 'input()\ninput()\nprint(16)');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  // Exact: the cases textarea's own text contains the label too, and matching
  // it returns before the run has even finished.
  await expect(page.getByText('більший прямокутник', { exact: true })).toBeVisible({ timeout: 15_000 });
  // Only rendered once the finished run has been judged against the checks —
  // asserting Publish disabled before that would also pass mid-run, when it is
  // disabled merely because nothing has finished yet.
  await expect(page.getByText('Еталонний розв\'язок не проходить власні перевірки:')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeDisabled();

  await typeIntoEditor(page, 1, 'a = float(input())\nb = float(input())\nprint(2 * (a + b))');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('button', { name: 'Опублікувати' })).toBeEnabled({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});
