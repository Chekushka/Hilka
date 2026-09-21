import { expect, test, type Page } from '@playwright/test';

/**
 * The vertical slice, end to end: prompt → editor → run → check → result.
 * If this passes, the stack works; every later task type plugs into the same
 * frame.
 */

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  // insertText writes the document directly, so no input handler fires and no
  // auto-indent happens: the indentation has to be in the string. A student
  // pressing Enter does get auto-indent, which is a different code path.
  await page.keyboard.insertText(code);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/practice');
  // The engine takes a moment; the workspace says so rather than showing a
  // dead button, and the button becomes usable when it is ready.
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
});

test('shows the task and the target drawing before anything is run', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Квадрат' })).toBeVisible();
  await expect(page.getByText('Намалюй квадрат зі стороною 100.')).toBeVisible();
  await expect(page.getByRole('img')).toBeVisible();
});

test('a correct square passes', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});

test('the same square turned the other way also passes', async ({ page }) => {
  // right(90) and left(270) draw the same picture. Failing this student is the
  // event the whole comparison design exists to prevent.
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.left(270)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});

test('a rectangle does not pass, and says why without shouting', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(2):\n    turtle.forward(150)\n    turtle.right(90)\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Нічого не втрачено.')).toBeVisible();
  // Never the word "Помилка" as a heading, and never a traceback.
  await expect(page.getByText('Traceback')).toHaveCount(0);
});

test('a syntax error is explained, not reported', async ({ page }) => {
  await typeSolution(page, 'import turtle\nturtle.forward(100');
  await page.getByRole('button', { name: 'Запустити' }).click();
  // The humanized message names the actual mistake rather than repeating the
  // interpreter, and shows the student's own line back to them.
  const heading = page.getByRole('heading', { name: 'Не закрита дужка' });
  await expect(heading).toBeVisible({ timeout: 20_000 });
  // The failing line is quoted back inside the message. It also exists in the
  // editor above, so the assertion is scoped to the result panel — which is the
  // live region, since the outer section wraps the editor too.
  const panel = page.locator('section[aria-live="polite"]');
  await expect(panel.getByText('turtle.forward(100')).toBeVisible();
  await expect(page.getByText('SyntaxError')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Спробувати ще' })).toBeVisible();
});

test('a mistyped turtle command names the command', async ({ page }) => {
  await typeSolution(page, 'import turtle\nturtle.forwrd(100)');
  await page.getByRole('button', { name: 'Запустити' }).click();
  await expect(page.getByRole('heading', { name: /forwrd/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('AttributeError')).toHaveCount(0);
});

test('an endless loop is reported as not finishing, not as an error', async ({ page }) => {
  await typeSolution(page, 'while True:\n    pass');
  await page.getByRole('button', { name: 'Запустити' }).click();
  await expect(page.getByRole('heading', { name: 'Програма не завершилася' })).toBeVisible({ timeout: 30_000 });
});

test('hints reveal one at a time', async ({ page }) => {
  await page.getByRole('button', { name: 'Показати підказку' }).click();
  await expect(page.getByText('Черепашка вміє йти вперед')).toBeVisible();
  await expect(page.getByText('Щоб повернути праворуч')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ще підказка' }).click();
  await expect(page.getByText('Щоб повернути праворуч')).toBeVisible();
});

test('running a program that calls input() opens a live answer line', async ({ page }) => {
  // Plain Run is interactive (lib/task/use-task-runner.ts) — Check stays
  // headless, unaffected. This is the student exploring their own program,
  // not the graded square, so the syntax error/mistyped-command fixtures
  // above are untouched by the switch.
  await typeSolution(page, 'name = input("Як тебе звати? ")\nprint("Привіт, " + name)');
  await page.getByRole('button', { name: 'Запустити' }).click();

  const answer = page.getByLabel('Відповідь для input()');
  await expect(answer).toBeVisible({ timeout: 20_000 });
  // The prompt passed to input(...) is shown next to the field, not printed
  // into the output panel above it. Exact match: the editor above also
  // contains this text as source code.
  await expect(page.getByText('Як тебе звати?', { exact: true })).toBeVisible();

  await answer.fill('Тарас');
  await answer.press('Enter');

  await expect(page.getByText('Привіт, Тарас')).toBeVisible({ timeout: 20_000 });
  await expect(answer).toHaveCount(0);
});
