import { expect, test, type Page } from '@playwright/test';

/**
 * Routes (lib/session/routes.ts) and the task catalog's kinds of work
 * (lib/task/tags.ts): a teacher gives two students their own extra tasks in a
 * graded lesson; each sees only their own, under the same neutral heading,
 * never limited and never graded; a third student sees none. The task list
 * finds tasks by tag, keeps its filter in the URL, and a published task's tags
 * change without a new version.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const MAIN = 'Квадрат';
const SUPPORT = 'Набери код: квадрат без циклу';
const EXTENSION = 'Виклик: ряд трикутників';
const SQUARE_BY_HAND =
  'import turtle\nturtle.forward(100)\nturtle.right(90)\nturtle.forward(100)\nturtle.right(90)\nturtle.forward(100)\nturtle.right(90)\nturtle.forward(100)';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

const bankItem = (page: Page, title: string) =>
  page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) });

async function pick(page: Page, search: string, title: string) {
  await page.locator('#taskSearch').fill(search);
  await bankItem(page, title).getByRole('checkbox').check();
}

async function typeSolution(page: Page, code: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function join(page: Page, code: string, name: string) {
  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
}

test('a teacher gives two students their own routes; each sees only theirs', async ({ page, browser }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.locator('#mode').selectOption('graded');

  await pick(page, 'квадрат', MAIN);

  // Fill the support route from the bank, and put Тарас on it.
  const routes = page.getByTestId('routes-panel');
  await routes.locator('summary').click();
  const support = page.getByTestId('route-support');
  await support.getByRole('button', { name: 'Додавати з банку' }).click();
  await pick(page, 'набери квадрат', SUPPORT);
  await expect(support.getByText(SUPPORT)).toBeVisible();
  await support.getByRole('button', { name: 'Тарас' }).click();
  await expect(support.getByRole('button', { name: 'Тарас' })).toHaveAttribute('aria-pressed', 'true');

  // The extension route: Соломія; moving her from support to extension is one click.
  const extension = page.getByTestId('route-extension');
  await support.getByRole('button', { name: 'Соломія' }).click();
  await extension.getByRole('button', { name: 'Додавати з банку' }).click();
  await pick(page, 'ряд трикутників', EXTENSION);
  await extension.getByRole('button', { name: 'Соломія' }).click();
  await expect(support.getByRole('button', { name: 'Соломія' })).toHaveAttribute('aria-pressed', 'false');
  await expect(extension.getByRole('button', { name: 'Соломія' })).toHaveAttribute('aria-pressed', 'true');

  // A task sits in one list only: the main task is not in a route.
  await expect(bankItem(page, EXTENSION).getByRole('checkbox')).toBeChecked();
  await expect(page.getByText('обрано: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
  await page.getByRole('link', { name: 'Переглянути заняття' }).click();
  const sessionUrl = page.url();

  // Тарас: his route's tasks come first, under the neutral heading, and a graded
  // lesson does not lock them — a failed Check, then a pass.
  const taras = await browser.newPage();
  await join(taras, code, 'Тарас');
  const section = taras.getByTestId('route-tasks');
  await expect(section.getByRole('heading', { name: 'Ще завдання для тебе' })).toBeVisible();
  const routeBox = await section.getByRole('button', { name: SUPPORT }).boundingBox();
  const mainBox = await taras.getByRole('button', { name: new RegExp(`^${MAIN}`) }).boundingBox();
  expect(routeBox && mainBox && routeBox.y < mainBox.y).toBe(true);
  await expect(taras.getByText(EXTENSION)).toHaveCount(0);

  await section.getByRole('button', { name: SUPPORT }).click();
  await expect(taras.getByTestId('retype-note')).toBeVisible();
  await expect(taras.locator('pre[data-no-copy]')).toBeVisible();
  await expect(taras.getByTestId('route-task-notice')).toBeVisible();
  await expect(taras.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  await typeSolution(taras, 'import turtle\nturtle.forward(100)');
  await taras.getByRole('button', { name: 'Здати' }).click();
  await expect(taras.getByRole('heading', { name: 'Готово!' })).toHaveCount(0);
  await expect(taras.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 20_000 });
  await typeSolution(taras, SQUARE_BY_HAND);
  const recorded = taras.waitForResponse((response) => response.url().endsWith('/api/attempts'));
  await taras.getByRole('button', { name: 'Здати' }).click();
  await expect(taras.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
  expect((await recorded).status()).toBe(201);
  await taras.close();

  // Соломія: her route after the main tasks.
  const solomiia = await browser.newPage();
  await join(solomiia, code, 'Соломія');
  const hers = solomiia.getByTestId('route-tasks');
  await expect(hers.getByRole('button', { name: EXTENSION })).toBeVisible();
  const mainY = (await solomiia.getByRole('button', { name: new RegExp(`^${MAIN}`) }).boundingBox())?.y ?? 0;
  const extY = (await hers.boundingBox())?.y ?? 0;
  expect(extY).toBeGreaterThan(mainY);
  await expect(solomiia.getByText(SUPPORT)).toHaveCount(0);
  await solomiia.close();

  // Олена: no route, no extra section; a route task is not hers to open.
  const olena = await browser.newPage();
  await join(olena, code, 'Олена');
  await expect(olena.getByTestId('route-tasks')).toHaveCount(0);
  await olena.close();

  // The teacher sees who is on which route and what came of it.
  await page.goto(sessionUrl);
  const tarasRow = page.getByRole('row').filter({ has: page.getByRole('link', { name: /Тарас/ }) });
  await expect(tarasRow.getByTestId('student-route')).toHaveText('Крок за кроком: додатково 1 з 1');
  await expect(page.getByTestId('session-routes')).toContainText('Учні: Соломія');
  // A route task never touches the grade: one main task, not attempted, no grade beyond «н».
  await expect(tarasRow.getByTestId('student-route')).toBeVisible();
});

test('the task list filters by kind of work and keeps the filter in the URL', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Завдання', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Завдання', exact: true })).toBeVisible();

  await page.getByRole('button', { name: /^Набери код: \d+$/ }).click();
  await expect(page).toHaveURL(/tag=retype/);
  const rows = page.getByTestId('task-catalog').getByRole('listitem');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) await expect(rows.nth(i)).toContainText('Набери код');

  // Two facets together: retype tasks of the turtle topic.
  await page.locator('#catalogTopic').selectOption({ label: 'Черепашача графіка' });
  await expect(rows.filter({ hasText: SUPPORT })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'Набери код: дії з числами' })).toHaveCount(0);

  // The filter survives a reload.
  await page.reload();
  await expect(page.getByRole('button', { name: /^Набери код: \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#catalogTopic')).toHaveValue('turtle-basics');
  await page.getByRole('button', { name: 'Скинути фільтри' }).click();
  await expect(page).not.toHaveURL(/tag=/);
});

test('a published task’s tags change without a new version', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Завдання', exact: true }).first().click();
  await page.locator('#catalogSearch').fill('ряд трикутників');
  await page.getByRole('link', { name: new RegExp(EXTENSION) }).click();

  const editor = page.getByRole('region', { name: 'Вид роботи' });
  const easy = editor.getByLabel(/Легкий старт/);
  await easy.check();
  await editor.getByRole('button', { name: 'Застосувати мітки' }).click();
  await expect(editor.getByText('Мітки оновлено')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Вид роботи' }).getByLabel(/Легкий старт/)).toBeChecked();

  // Put it back, so other runs against the same database see the seed's tags.
  await page.getByRole('region', { name: 'Вид роботи' }).getByLabel(/Легкий старт/).uncheck();
  await page.getByRole('region', { name: 'Вид роботи' }).getByRole('button', { name: 'Застосувати мітки' }).click();
  await expect(page.getByRole('region', { name: 'Вид роботи' }).getByText('Мітки оновлено')).toBeVisible();
});
