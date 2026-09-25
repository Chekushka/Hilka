import { expect, test, type Page } from '@playwright/test';

/**
 * Two workspace behaviours: the turtle canvas appears only where a task
 * draws, and a passed Check offers a button straight to the next task — the
 * lesson's next step in practice, the next open task in a session, without
 * reopening a graded task locked by its first Check. Several seed titles
 * contain «Квадрат», so every title locator here is exact.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const NEXT = 'Перейти до наступного завдання';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function waitForEngine(page: Page) {
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
}

async function checkAndPass(page: Page) {
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
}

const drawing = (page: Page) => page.getByRole('img', { name: 'Твій малюнок' });

const SQUARE = 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)';
const TRIANGLE =
  'import turtle\nturtle.forward(100)\nturtle.left(120)\nturtle.forward(100)\nturtle.left(120)\nturtle.forward(100)';

test('a console code task shows no canvas, before or after running', async ({ page }) => {
  await page.goto('/practice/g7-28-linear/g7-code-rectangle-area');
  await expect(page.getByRole('heading', { name: 'Площа прямокутника', exact: true })).toBeVisible();
  await waitForEngine(page);
  await expect(drawing(page)).toHaveCount(0);

  await typeSolution(page, 'a = float(input())\nb = float(input())\nprint(a * b)');
  await checkAndPass(page);
  await expect(drawing(page)).toHaveCount(0);
});

test('a console fix task shows no canvas', async ({ page }) => {
  await page.goto('/practice/g7-40-debugging/g7-fix-missing-colon');
  await expect(page.getByRole('heading', { name: 'Забута двокрапка', exact: true })).toBeVisible();
  await waitForEngine(page);
  await expect(drawing(page)).toHaveCount(0);
});

test('turtle code and fill tasks show the canvas before anything runs', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle/g7-turtle-square');
  await expect(page.getByRole('heading', { name: 'Квадрат', exact: true })).toBeVisible();
  await waitForEngine(page);
  await expect(drawing(page)).toBeVisible();

  // `fill` has no surface field; the pentagon's shape checks mark it as drawing.
  await page.goto('/practice/g7-38-turtle-loops/g7-fill-pentagon');
  await expect(page.getByRole('heading', { name: "Заповни пропуски: п'ятикутник", exact: true })).toBeVisible();
  await waitForEngine(page);
  await expect(drawing(page)).toBeVisible();
});

test('in practice, a passed Check leads to the lesson\'s next task, and the last one back to the lesson', async ({
  page
}) => {
  await page.goto('/practice/g7-29-turtle/g7-turtle-square');
  await waitForEngine(page);
  // Nothing to move on to before the Check passes.
  await expect(page.getByRole('link', { name: NEXT, exact: true })).toHaveCount(0);
  await typeSolution(page, SQUARE);
  await checkAndPass(page);
  await page.getByRole('link', { name: NEXT, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Трикутник', exact: true })).toBeVisible();

  // Вартість поїздки is the last step of its lesson.
  await page.goto('/practice/g7-28-linear/g7-code-trip-cost');
  await waitForEngine(page);
  await typeSolution(
    page,
    'distance = float(input())\nper100 = float(input())\nprice = float(input())\nprint(distance * per100 / 100 * price)'
  );
  await checkAndPass(page);
  await expect(page.getByRole('link', { name: NEXT, exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Повернутися до уроку', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Лінійний алгоритм', level: 1 })).toBeVisible();
});

async function buildSession(page: Page, mode: 'practice' | 'graded'): Promise<string> {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  // The demo class's roster (Олена, Тарас, Соломія) is what this relies on.
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption(mode);
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Черепашача графіка' });
  // Click order is the session's task order: Квадрат, then Трикутник.
  for (const title of ['Квадрат', 'Трикутник']) {
    await page
      .getByRole('listitem')
      .filter({ has: page.getByText(title, { exact: true }) })
      .getByRole('checkbox')
      .check();
  }
  await expect(page.getByText('обрано: 2')).toBeVisible();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  return code;
}

test('in a practice session, a passed Check leads to the next task, and the last one back to the list', async ({
  page
}) => {
  await buildSession(page, 'practice');

  await page.getByRole('button', { name: 'Квадрат', exact: true }).click();
  await waitForEngine(page);
  await typeSolution(page, SQUARE);
  await checkAndPass(page);
  await page.getByRole('button', { name: NEXT, exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Трикутник', exact: true })).toBeVisible();
  await waitForEngine(page);
  await typeSolution(page, TRIANGLE);
  await checkAndPass(page);
  await expect(page.getByRole('button', { name: NEXT, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Повернутися до списку завдань', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Квадрат/ })).toContainText('Виконано');
  await expect(page.getByRole('button', { name: /^Трикутник/ })).toContainText('Виконано');
});

test('in a graded session, the next-task button moves on without reopening a locked task', async ({ page }) => {
  await buildSession(page, 'graded');

  await page.getByRole('button', { name: 'Квадрат', exact: true }).click();
  await waitForEngine(page);
  await typeSolution(page, SQUARE);
  await page.getByRole('button', { name: 'Перевірити' }).click();

  // The first Check locks the task; the locked screen carries the way on.
  await expect(page.getByRole('heading', { name: 'Завдання здано' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: NEXT, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Трикутник', exact: true })).toBeVisible();

  // A failed first Check locks too, and offers no next task.
  await waitForEngine(page);
  await typeSolution(page, 'import turtle\nturtle.forward(100)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Завдання здано' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: NEXT, exact: true })).toHaveCount(0);

  // Going back to the square still shows it locked, not a fresh editor.
  await page.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await page.getByRole('button', { name: /^Квадрат/ }).click();
  await expect(page.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveCount(0);
});
