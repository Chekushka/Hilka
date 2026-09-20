import { expect, test, type Page } from '@playwright/test';

/**
 * Practice progress codes (docs/AI_CONTEXT.md, "Progress Codes"):
 * localStorage is the primary store, a code is portability and backup. The
 * merge test opens a fresh `browser.newContext()` — a separate storage
 * origin, unlike `context.newPage()` which would share the first page's
 * localStorage — to simulate "another machine" without a second browser.
 */

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
});

test('the progress panel starts with nothing saved and no code', async ({ page }) => {
  await expect(page.getByText('Виконано завдань: 0')).toBeVisible();
  await expect(page.getByText('Це завдання вже виконано раніше.')).toHaveCount(0);
  await expect(page.getByText(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)).toHaveCount(0);
});

test('passing the task marks it completed locally', async ({ page }) => {
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  await expect(page.getByText('Виконано завдань: 1')).toBeVisible();
  await expect(page.getByText('Це завдання вже виконано раніше.')).toBeVisible();

  // Survives a reload — localStorage, not component state.
  await page.reload();
  await expect(page.getByText('Виконано завдань: 1')).toBeVisible();
  await expect(page.getByText('Це завдання вже виконано раніше.')).toBeVisible();
});

test('saving mints a code, and saving again reuses it', async ({ page }) => {
  await page.getByRole('button', { name: 'Зберегти код прогресу' }).click();
  const codeText = page.locator('p.font-mono.text-lg');
  await expect(codeText).toBeVisible({ timeout: 10_000 });
  const firstCode = await codeText.textContent();
  expect(firstCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  await page.getByRole('button', { name: 'Зберегти код прогресу' }).click();
  await expect(codeText).toHaveText(firstCode ?? '');
});

test('a code saved on one browser restores on another and merges progress', async ({ page, browser }) => {
  // "Machine one": pass the task and save a code.
  await typeSolution(page, 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)');
  await page.getByRole('button', { name: 'Перевірити' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Зберегти код прогресу' }).click();
  const codeText = page.locator('p.font-mono.text-lg');
  await expect(codeText).toBeVisible({ timeout: 10_000 });
  const code = (await codeText.textContent()) ?? '';
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // "Machine two": a separate browser context, so localStorage starts empty.
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await other.goto('/practice');
  await expect(other.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  await expect(other.getByText('Виконано завдань: 0')).toBeVisible();

  await other.getByLabel('Код прогресу з іншого пристрою').fill(code);
  await other.getByRole('button', { name: 'Відновити' }).click();
  await expect(other.getByText('Прогрес відновлено.')).toBeVisible({ timeout: 10_000 });
  await expect(other.getByText('Виконано завдань: 1')).toBeVisible();
  await expect(other.getByText('Це завдання вже виконано раніше.')).toBeVisible();
  await otherContext.close();
});

test('an unknown code is rejected with a calm message', async ({ page }) => {
  await page.getByLabel('Код прогресу з іншого пристрою').fill('ZZZZ-9999');
  await page.getByRole('button', { name: 'Відновити' }).click();
  await expect(page.getByText('Такого коду не знайдено. Перевір, чи правильно ти його ввів.')).toBeVisible({
    timeout: 10_000
  });
});

test('a malformed code is rejected before it looks anything up', async ({ page }) => {
  await page.getByLabel('Код прогресу з іншого пристрою').fill('ABC');
  await page.getByRole('button', { name: 'Відновити' }).click();
  await expect(page.getByText("Код має складатися з 8 символів.")).toBeVisible({ timeout: 10_000 });
});
