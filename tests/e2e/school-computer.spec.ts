import { expect, test, type Page } from '@playwright/test';

/**
 * School computers (docs/AI_CONTEXT.md, "School Computers"): a PC marked at
 * /school keeps practice progress only in sessionStorage, saves every change
 * to the student's code, forgets a student who walked away or pressed
 * «Завершити», and keeps a teacher's login only until the browser closes.
 */

const TASK = '/practice/g7-29-turtle/g7-turtle-square';
const SQUARE = 'import turtle\nfor i in range(4):\n    turtle.forward(100)\n    turtle.right(90)';
const PRACTICE_KEYS = ['hilka:practice:progress', 'hilka:practice:code'];

async function solveSquare(page: Page) {
  await page.goto(TASK);
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(SQUARE);
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
}

const stored = (page: Page, area: 'localStorage' | 'sessionStorage') =>
  page.evaluate(
    ([which, keys]) => (keys as string[]).map((key) => window[which as 'localStorage'].getItem(key)),
    [area, PRACTICE_KEYS] as const
  );

async function markAsSchool(page: Page) {
  await page.goto('/school');
  await expect(page.getByTestId('school-state')).toHaveText('Цей комп\'ютер не позначено.');
  await page.getByRole('button', { name: 'Позначити як шкільний' }).click();
  await expect(page.getByTestId('school-state')).toHaveText('Цей комп\'ютер позначено як шкільний.');
}

test('marking a PC wipes what an earlier student left, and progress then lives only in the tab, under a code', async ({ page }) => {
  // An earlier student practised here before the PC was marked.
  await solveSquare(page);
  expect((await stored(page, 'localStorage'))[0]).not.toBeNull();
  await expect(page.getByTestId('school-bar')).toHaveCount(0);

  await markAsSchool(page);
  expect(await stored(page, 'localStorage')).toEqual([null, null]);

  await page.goto(TASK);
  await expect(page.getByText('Виконано завдань: 0')).toBeVisible();
  await expect(page.getByTestId('school-bar')).toContainText('Розв\'яжи завдання — і з\'явиться твій код.');

  await solveSquare(page);
  // Saved to a fresh code at once, with nothing pressed.
  const code = page.getByTestId('school-code');
  await expect(code).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, { timeout: 10_000 });
  expect(await stored(page, 'localStorage')).toEqual([null, null]);
  expect((await stored(page, 'sessionStorage'))[0]).toContain('g7-turtle-square');

  // The code really holds it.
  const restored = await page.evaluate(async (value) => {
    const response = await fetch('/api/progress/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: value })
    });
    return (await response.json()) as { state: { completedTaskSlugs: string[] } };
  }, (await code.textContent()) ?? '');
  expect(restored.state.completedTaskSlugs).toContain('g7-turtle-square');
});

test('a student who walked away leaves nothing for the next one', async ({ page }) => {
  await markAsSchool(page);
  await solveSquare(page);
  await expect(page.getByTestId('school-code')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Виконано завдань: 1')).toBeVisible();

  // Twenty-one minutes without a key press or a click, then the next student clicks.
  await page.evaluate(() => sessionStorage.setItem('hilka:practice:active', String(Date.now() - 21 * 60 * 1000)));
  await page.getByRole('heading', { name: 'Твій прогрес' }).click();
  await expect(page.getByText('Виконано завдань: 0')).toBeVisible();
  await expect(page.getByTestId('school-code')).toHaveCount(0);
  expect(await stored(page, 'sessionStorage')).toEqual([null, null]);
});

test('«Завершити» shows the code once more, then forgets the student', async ({ page }) => {
  await markAsSchool(page);
  await solveSquare(page);
  const code = (await page.getByTestId('school-code').textContent({ timeout: 10_000 })) ?? '';
  await expect(page.getByTestId('school-code')).toHaveText(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/, { timeout: 10_000 });

  await page.getByRole('button', { name: 'Завершити' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Запиши свій код:');
  await expect(dialog).toContainText((await page.getByTestId('school-code').textContent()) ?? code);
  await dialog.getByRole('button', { name: 'Записав — завершити' }).click();

  await expect(page.getByRole('heading', { name: 'Python — крок за кроком' })).toBeVisible();
  expect(await stored(page, 'sessionStorage')).toEqual([null, null]);
  await page.goto(TASK);
  await expect(page.getByText('Виконано завдань: 0')).toBeVisible();
});

test('a teacher login on a school computer ends with the browser', async ({ page, context }) => {
  // The magic link lands on `localhost` (AI_CONTEXT.md, Gotchas), so the PC is marked on both names.
  await context.addCookies(
    ['127.0.0.1', 'localhost'].map((domain) => ({ name: 'hilka_school', value: '1', domain, path: '/' }))
  );
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('demo-teacher@hilka.dev');
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();

  const teacherCookie = (await context.cookies()).find((cookie) => cookie.name === 'hilka_teacher');
  expect(teacherCookie?.expires).toBe(-1);
});

test('the mark can be taken off again', async ({ page }) => {
  await markAsSchool(page);
  await page.getByRole('button', { name: 'Зняти позначку' }).click();
  await expect(page.getByTestId('school-state')).toHaveText('Цей комп\'ютер не позначено.');
  await page.goto(TASK);
  await expect(page.getByTestId('school-bar')).toHaveCount(0);
});
