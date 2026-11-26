import { expect, test, type Page } from '@playwright/test';

/**
 * A lesson's theory on the projector (/present/[lesson],
 * components/lesson/PresentDeck.tsx): the teacher leads — nothing waits for
 * an answer, any card is a tap away, forward opens a guess's answer before it
 * moves on, a tap records the class's pick, and the text size is the room's.
 * Opened from the lesson list and from a session whose tasks are one
 * lesson's. Uses the seeded «Змінні» lesson: seven cards, guesses on 4 and 6.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  // By its path: the link names the server's own host, which need not be the one the cookie should land on.
  const link = new URL(href);
  await page.goto(link.pathname + link.search);
}

const rootFontPx = (page: Page) =>
  page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));

test('the theory on the projector is led by the teacher and records nothing', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/present/g7-26-variables');
  const deck = page.getByTestId('present-deck');
  const position = page.getByTestId('theory-position');
  const forward = page.getByTestId('present-forward');
  await expect(position).toHaveText('Картка 1 з 7');
  await expect(deck.getByTestId('card-band')).toHaveText('Ідея');
  // Larger than the student's page: the root font follows the window.
  expect(await rootFontPx(page)).toBeGreaterThan(18);

  // A remote's PageDown and the arrows move; no focus needed.
  await page.keyboard.press('PageDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('PageDown');
  await expect(position).toHaveText('Картка 4 з 7');

  // A guess: forward first opens the answer, without anyone's pick.
  await expect(deck.getByTestId('card-band')).toHaveText('Як думаєш?');
  await expect(forward).toHaveText('Показати відповідь');
  await expect(deck.getByTestId('guess-feedback')).toHaveCount(0);
  await page.keyboard.press('PageDown');
  await expect(position).toHaveText('Картка 4 з 7');
  await expect(deck.getByTestId('guess-feedback')).toContainText('Ось що виведе програма:');
  await expect(deck.getByTestId('guess-output')).toContainText('7');
  await expect(forward).toHaveText(/^Далі/);
  await page.keyboard.press('PageDown');
  await expect(position).toHaveText('Картка 5 з 7');
  // Back keeps the answer open.
  await page.keyboard.press('PageUp');
  await expect(deck.getByTestId('guess-feedback')).toBeVisible();

  // Any card is a tap away, ahead too; a tap on an option is the class's pick.
  await deck.getByRole('button', { name: 'До картки 6' }).click();
  await expect(position).toHaveText('Картка 6 з 7');
  const guess = deck.getByTestId('guess-card');
  await guess.getByRole('button', { name: /^Привіт, name!$/ }).click();
  await expect(deck.getByTestId('guess-feedback')).toContainText('Не зовсім');
  await expect(guess.getByRole('button', { name: /^Привіт, name!\W*обрав клас$/ })).toBeDisabled();

  // The last card ends the deck quietly.
  await page.keyboard.press('End');
  await expect(position).toHaveText('Картка 7 з 7');
  await expect(page.getByTestId('present-end')).toHaveText('Це остання картка');
  await expect(forward).toHaveCount(0);

  // The text size is the room's, and this browser remembers it.
  const before = await rootFontPx(page);
  await page.getByRole('button', { name: 'Більший текст' }).click();
  await page.keyboard.press('+');
  const bigger = await rootFontPx(page);
  expect(bigger).toBeGreaterThan(before);
  await page.reload();
  await expect(position).toHaveText('Картка 1 з 7');
  await expect.poll(() => rootFontPx(page)).toBeCloseTo(bigger, 0);
  await page.getByRole('button', { name: 'Менший текст' }).click();
  await page.keyboard.press('-');
  await expect.poll(() => rootFontPx(page)).toBeCloseTo(before, 0);

  // Nothing went into the student's progress: the theory XP is not earned by showing it.
  await page.goto('/practice');
  await expect(page.getByTestId('xp-total')).not.toHaveText('10 XP');
});

test('the teacher opens a lesson\'s theory from the lesson list and from a session on that lesson', async ({ page }) => {
  await loginAsTeacher(page);
  await page.goto('/lessons');
  const row = page.getByRole('row').filter({ has: page.getByRole('link', { name: 'Змінні', exact: true }) });
  await expect(row.getByTestId('show-theory')).toHaveAttribute('href', '/present/g7-26-variables');

  // A session on one lesson's tasks offers that lesson's theory.
  await page.goto('/sessions/new');
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.locator('#taskSearch').fill('ім\'я змінної');
  await page
    .getByRole('listitem')
    .filter({ has: page.getByText("Правильне ім'я змінної", { exact: true }) })
    .getByRole('checkbox')
    .check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'Переглянути заняття' }).click();
  const theory = page.getByTestId('session-theory').getByTestId('show-theory');
  await expect(theory).toHaveText('Змінні');
  await expect(theory).toHaveAttribute('href', '/present/g7-26-variables');

  // It opens the projector window.
  const [popup] = await Promise.all([page.waitForEvent('popup'), theory.click()]);
  await expect(popup.getByTestId('present-deck')).toBeVisible();
  await expect(popup.getByTestId('theory-position')).toHaveText('Картка 1 з 7');
});
