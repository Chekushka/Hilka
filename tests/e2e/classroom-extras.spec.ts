import { expect, test, type Page } from '@playwright/test';

/**
 * What the project owner asked for after classroom use:
 * - the code on the projector (/show/[id]) and a link besides the code — to
 *   the session and to one task in it;
 * - a drag task (a `fill` with a word bank, lib/task/fill.ts);
 * - the class race (lib/game/race.ts): points on the projector and in the room;
 * - an unfinished answer kept while the student looks at another task
 *   (lib/task/draft.ts);
 * - the theory's memory picture (lib/lessons/visuals.ts).
 * The class and the demo session come from scripts/db/seed-demo-session.ts.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const DRAG = 'Перетягни: якщо — інакше';
const QUIZ = 'Знак рівності в умові';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

async function pick(page: Page, search: string, title: string) {
  await page.locator('#taskSearch').fill(search);
  await page
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) })
    .getByRole('checkbox')
    .check();
}

async function typeSolution(page: Page, code: string) {
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('the projector, a link to one task, a drag task and the class race', async ({ page, browser }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await pick(page, 'знак рівності', QUIZ);
  await pick(page, 'перетягни', DRAG);
  await page.getByTestId('builder-game').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
  // Besides the code: the show-to-class button and the link to copy.
  await expect(page.getByTestId('show-to-class')).toBeVisible();
  await expect(page.getByTestId('copy-link-url')).toHaveText(new RegExp(`/s/${code}$`));

  await page.getByRole('link', { name: 'Переглянути заняття' }).click();
  await expect(page.getByTestId('session-code')).toHaveText(code);
  await expect(page.getByTestId('game-toggle')).toBeChecked();
  const dragTaskId = await page.locator('li[data-task-id]').filter({ hasText: DRAG }).getAttribute('data-task-id');
  expect(dragTaskId).toBeTruthy();
  const sessionUrl = new URL(page.url());
  const sessionId = sessionUrl.pathname.split('/').pop()!;

  // The projector window: the code one tile per character, and the race, empty for now.
  const show = await page.context().newPage();
  // The login cookie is on the dev link's host, so the same origin as the dashboard.
  await show.goto(`${sessionUrl.origin}/show/${sessionId}`);
  await expect(show.getByTestId('show-code')).toHaveAttribute('aria-label', `Код заняття: ${code.split('').join(' ')}`);
  await expect(show.getByTestId('show-race')).toContainText('Ще ніхто не стартував');

  // A student opens the link to the drag task: after the name, it is the task, not the list.
  const student = await browser.newPage();
  await student.goto(`/s/${code.toLowerCase()}?task=${dragTaskId}`);
  await student.getByRole('button', { name: 'Олена', exact: true }).click();
  await expect(student.getByRole('heading', { name: DRAG })).toBeVisible();
  await expect(student.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });

  // Tap a card into the first empty gap; tap the chosen gap, then a card, for the second.
  const tray = student.getByTestId('bank-tray');
  await tray.getByRole('button', { name: 'Картка if' }).click();
  await student.getByTestId('bank-gap').click();
  await tray.getByRole('button', { name: 'Картка else' }).click();
  await expect(tray.getByRole('button', { name: 'Картка if' })).toHaveCount(0);
  // A placed card taps back into the tray, and goes in again.
  await student.getByRole('button', { name: /Пропуск 2: else/ }).click();
  await expect(tray.getByRole('button', { name: 'Картка else' })).toBeVisible();
  await tray.getByRole('button', { name: 'Картка else' }).click();
  await student.getByRole('button', { name: 'Здати' }).click();
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible({ timeout: 20_000 });

  // The room's race card: first try, difficulty 1 — 15 points, and nobody ahead.
  await student.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await expect(student.getByTestId('race-my-points')).toHaveText('У тебе 15 б.');
  await expect(student.getByTestId('race-my-line')).toHaveText('Ти попереду всіх! Тримай темп.');

  // The projector picks it up on its next refresh.
  await expect(show.getByTestId('race-track')).toContainText('Олена', { timeout: 15_000 });
  await expect(show.getByTestId('race-track')).toContainText('15 б.');

  // The teacher can switch the race off; the room's card goes with it.
  await Promise.all([
    page.waitForResponse((response) => response.url().includes(`/api/dashboard/sessions/${sessionId}`) && response.ok()),
    page.getByTestId('game-toggle').uncheck()
  ]);
  await expect(page.getByTestId('game-toggle')).not.toBeChecked();
  await student.goto(`/s/${code.toLowerCase()}`);
  await expect(student.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  await expect(student.getByTestId('race-card')).toHaveCount(0);
});

test('an unfinished answer survives switching tasks, in a session and in practice', async ({ page }) => {
  await page.goto('/s/demo01');
  await page.getByRole('button', { name: 'Тарас', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  const rows = page.locator('button[data-task-id]');
  await rows.first().click();
  await expect(page.locator('.cm-content')).toBeVisible({ timeout: 30_000 });
  await typeSolution(page, 'import turtle\n# ще думаю');
  await page.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await rows.nth(1).click();
  await page.getByRole('button', { name: '← До списку завдань', exact: true }).click();
  await rows.first().click();
  await expect(page.locator('.cm-content')).toContainText('# ще думаю');

  // Practice: a typed gap is still there after another task and a reload.
  await page.goto('/practice/g7-31-if/g7-easy-fill-if');
  const gap = page.getByRole('textbox', { name: 'Пропуск 1' });
  await gap.fill('>');
  await page.goto('/practice/g7-31-if/g7-code-even-odd');
  await page.goto('/practice/g7-31-if/g7-easy-fill-if');
  await expect(page.getByRole('textbox', { name: 'Пропуск 1' })).toHaveValue('>');
});

test('the theory shows memory step by step and a flowchart', async ({ page }) => {
  await page.goto('/practice/g7-26-variables');
  const next = page.getByRole('button', { name: 'Далі', exact: true });
  await next.click();
  await next.click();
  const memory = page.getByTestId('theory-memory');
  await expect(memory).toBeVisible();
  await expect(page.getByTestId('memory-step')).toHaveText('Рядок 1 з 3');
  await page.getByTestId('memory-next').click();
  await page.getByTestId('memory-next').click();
  await expect(page.getByTestId('memory-step')).toHaveText('Рядок 3 з 3');
  // x changed from 5 to 10; y stays 7.
  await expect(memory.locator('li[data-changed="true"]')).toContainText('x');
  await expect(memory.locator('li[data-changed="true"]')).toContainText('10');
  await expect(memory).toContainText('7');

  await page.goto('/practice/g7-31-if');
  await page.getByRole('button', { name: 'Далі', exact: true }).click();
  await expect(page.getByTestId('theory-flow')).toContainText('x > 0');
});
