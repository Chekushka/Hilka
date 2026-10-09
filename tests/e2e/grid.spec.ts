import { expect, test, type Page } from '@playwright/test';
import { useJsonMode } from './authoring-helpers';

/**
 * The 8×8 grid world end to end (docs/TASK_SCHEMA.md, "Grid"): a student
 * steers the robot around the rocks — a bump is shown and said, a clean path
 * passes `grid_goal` — and a teacher builds a grid task by clicking the field
 * and publishes it against its own reference run.
 */

async function typeIntoEditor(page: Page, nth: number, code: string) {
  const editor = page.locator('.cm-content').nth(nth);
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

const AROUND =
  'import robot\nrobot.forward(2)\nrobot.left()\nrobot.forward()\nrobot.right()\nrobot.forward(3)\nrobot.right()\nrobot.forward()\nrobot.left()\nrobot.forward(2)\n';

test('the robot bumps into a rock, then a path around it passes', async ({ page }) => {
  await page.goto('/practice/g7-28-linear/g7-grid-around-rock');
  const field = page.getByRole('img', { name: /Поле 8×8/ });
  await expect(field).toBeVisible();
  await expect(field).toHaveAccessibleName(/стовпці 1, рядку 6, дивиться праворуч/);
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });

  await typeIntoEditor(page, 0, 'import robot\nrobot.forward(4)');
  await page.getByRole('button', { name: 'Запустити' }).click();
  await expect(page.getByText('Робот уперся в перешкоду в стовпці 3, рядку 6')).toBeVisible({ timeout: 20_000 });
  await expect(field).toHaveAccessibleName(/уперся в перешкоду/);

  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Ще не те' })).toBeVisible({ timeout: 20_000 });

  await typeIntoEditor(page, 0, AROUND);
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
  await expect(field).toHaveAccessibleName(/стовпці 8, рядку 6/);
});

test('a teacher places a rock on the field and publishes a grid task', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('demo-teacher@hilka.dev');
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  await page.goto(href!);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await page.getByLabel('Ідентифікатор (slug)').fill(`e2e-grid-${Date.now()}`);
  await page.getByLabel('Назва').fill('Робот навколо каменя');
  await page.getByLabel('Середовище').selectOption('grid');
  // The default world runs along row 5; a rock goes in its way.
  await page.getByRole('button', { name: 'Стовпець 5, рядок 5' }).click();
  await expect(page.getByRole('img', { name: /Поле 8×8/ })).toBeVisible();
  await page.getByLabel('Умова').fill('Обійди камінь і дійди до акумулятора.');
  await typeIntoEditor(page, 0, 'import robot\n');
  await useJsonMode(page, 'checks');
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'grid_goal' }]));

  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();

  // Straight ahead hits the rock: the reference itself is refused.
  await typeIntoEditor(page, 1, 'import robot\nrobot.forward(7)');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByText('Еталонний розв\'язок не проходить власні перевірки:')).toBeVisible({ timeout: 15_000 });

  await typeIntoEditor(
    page,
    1,
    'import robot\nrobot.forward(3)\nrobot.left()\nrobot.forward()\nrobot.right()\nrobot.forward(2)\nrobot.right()\nrobot.forward()\nrobot.left()\nrobot.forward(2)'
  );
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});

test('a fill task drives the robot: the gaps are the conditions of two while loops', async ({ page }) => {
  await page.goto('/practice/g7-35-while-practice/g7-grid-fill-wall-then-up');
  const field = page.getByRole('img', { name: /Поле 8×8/ });
  await expect(field).toHaveAccessibleName(/Акумулятор у стовпці 6, рядку 2/);
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });

  // The wrong question in the second loop: the way is free after the turn, so it never runs.
  await page.getByLabel('Пропуск 1').fill('can_move');
  await page.getByLabel('Пропуск 2').fill('left');
  await page.getByLabel('Пропуск 3').fill('can_move');
  await page.getByRole('button', { name: 'Запустити' }).click();
  await expect(page.getByText('Робот зупинився в стовпці 6, рядку 7. До акумулятора ще не дійшов.')).toBeVisible({
    timeout: 20_000
  });

  await page.getByLabel('Пропуск 3').fill('at_goal');
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
  await expect(field).toHaveAccessibleName(/робот у стовпці 6, рядку 2/);
});

test('a parameterized world puts each student\'s battery where their seed says, the same every time', async ({ page }) => {
  // In practice there is no student to seed from: listed, never opened.
  await page.goto('/practice/g7-28-linear');
  await expect(page.getByRole('listitem').filter({ hasText: 'Робот: свій акумулятор' })).toContainText(
    'лише на занятті з учителем'
  );

  await page.goto('/s/demo01');
  await page.getByRole('button', { name: 'Тарас' }).click();
  await page.getByRole('button', { name: 'Робот: свій акумулятор' }).click();
  const field = page.getByRole('img', { name: /Поле 8×8/ });
  const name = (await field.getAttribute('aria-label')) ?? '';
  const [, column, row] = name.match(/Акумулятор у стовпці (\d), рядку (\d)/) ?? [];
  expect(Number(column)).toBeGreaterThanOrEqual(4);
  expect(Number(column)).toBeLessThanOrEqual(7);
  expect(Number(row)).toBeGreaterThanOrEqual(2);
  expect(Number(row)).toBeLessThanOrEqual(4);

  // The same student gets the same world after a reload.
  await page.reload();
  await page.getByRole('button', { name: 'Робот: свій акумулятор' }).click();
  await expect(page.getByRole('img', { name: /Поле 8×8/ })).toHaveAccessibleName(
    new RegExp(`Акумулятор у стовпці ${column}, рядку ${row}`)
  );

  // The robot starts in column 2, row 7, facing up: climb to the row, turn, walk to the column.
  await expect(page.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  await typeIntoEditor(page, 0, `import robot\nrobot.forward(${7 - Number(row)})\nrobot.right()\nrobot.forward(${Number(column) - 2})\n`);
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });
});

test('a teacher puts a fill task on the grid and publishes it', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill('demo-teacher@hilka.dev');
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  await page.goto(href!);

  await page.getByRole('link', { name: 'Завдання' }).click();
  await page.getByRole('link', { name: 'Нове завдання' }).click();
  await page.getByLabel('Тип завдання').selectOption('fill');
  await page.getByLabel('Ідентифікатор (slug)').fill(`e2e-grid-fill-${Date.now()}`);
  await page.getByLabel('Назва').fill('Робот: скільки кроків');
  await page.getByLabel('Умова').fill('Скільки кроків до акумулятора?');
  await page.getByLabel('Шаблон').fill('import robot\nrobot.forward({{1}})\n');
  await page.getByLabel('Робот на полі 8×8').check();
  // The default world: left edge to right edge along row 5.
  await expect(page.getByRole('img', { name: /Поле 8×8/ })).toBeVisible();
  await useJsonMode(page, 'checks');
  await page.getByLabel('Перевірки (JSON)').fill(JSON.stringify([{ kind: 'grid_goal' }]));
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith('/api/tasks') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Створити чернетку' }).click()
  ]);
  await expect(page.getByRole('heading', { name: 'Редагування чернетки' })).toBeVisible();
  await expect(page.getByLabel('Робот на полі 8×8')).toBeChecked();

  // One step short stops before the battery, and publish refuses it; seven steps reach it.
  await typeIntoEditor(page, 0, 'import robot\nrobot.forward(6)\n');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('img', { name: /робот у стовпці 7, рядку 5/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Еталонний розв\'язок не проходить власні перевірки:')).toBeVisible({ timeout: 15_000 });
  await typeIntoEditor(page, 0, 'import robot\nrobot.forward(7)\n');
  await page.getByRole('button', { name: 'Запустити еталон' }).click();
  await expect(page.getByRole('img', { name: /робот у стовпці 8, рядку 5/ })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Опублікувати' }).click();
  await expect(page.getByText('Опубліковано. Версія 1.')).toBeVisible({ timeout: 15_000 });
});
