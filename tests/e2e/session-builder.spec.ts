import { expect, test, type Page } from '@playwright/test';

/**
 * Session builder (docs/TASKS.md, "Session builder"): a teacher picks a
 * class, filters the published task catalog, assigns tasks, and gets back a
 * join code a student can actually use — end to end, not just the form.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const link = page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ });
  const href = await link.getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

test('a teacher builds a session, and a student can join it', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await expect(page.getByRole('heading', { name: 'Нове заняття' })).toBeVisible();

  // Filtering by topic narrows the checklist to that topic's tasks — other
  // e2e specs publish their own tasks into the same shared database, so this
  // picks the seed square specifically rather than assuming it is the only
  // (or the first) item in the list.
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Черепашача графіка' });
  const squareItem = page.getByRole('listitem').filter({ has: page.getByText('Квадрат', { exact: true }) });
  await expect(squareItem).toBeVisible();
  await squareItem.getByRole('checkbox').check();
  await expect(page.getByText('обрано: 1')).toBeVisible();

  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });

  const codeText = page.locator('p.font-mono.text-2xl');
  const code = ((await codeText.textContent()) ?? '').trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await page.getByRole('link', { name: 'Переглянути заняття' }).click();
  await expect(page.getByRole('heading', { name: `Заняття ${code}` })).toBeVisible();
  await expect(page.getByText('Спроб ще немає.')).toBeVisible();

  // The code the builder minted actually joins, with only the one assigned task.
  await page.goto(`/s/${code.toLowerCase()}`);
  await expect(page.getByRole('button', { name: 'Олена' })).toBeVisible();
  await page.getByRole('button', { name: 'Олена' }).click();
  await expect(page.getByRole('button', { name: 'Квадрат', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Трикутник' })).toHaveCount(0);
});

test('creating a session with no tasks selected is rejected before it ever posts', async ({ page }) => {
  await loginAsTeacher(page);
  // An in-page click, not page.goto: the login redirect lands on the
  // `localhost` origin the dev magic-link is built against (AI_CONTEXT.md's
  // Gotcha on `request.url`), and a relative `page.goto` afterward resolves
  // against playwright.config.ts's `baseURL` (127.0.0.1) instead, silently
  // dropping the auth cookie — a click stays on whatever origin the browser
  // is actually on.
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Оберіть хоча б одне завдання.')).toBeVisible();
});

test('the session builder link requires a logged-in teacher', async ({ page }) => {
  await page.goto('/sessions/new');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});

test('search narrows the bank, and the chosen order is the order students meet', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });

  await page.getByLabel('Пошук').fill('трикутник');
  await expect(page.getByRole('listitem').filter({ has: page.getByText('Квадрат', { exact: true }) })).toHaveCount(0);
  await page.getByRole('listitem').filter({ has: page.getByText('Трикутник', { exact: true }) }).getByRole('checkbox').check();
  await page.getByLabel('Пошук').fill('квадрат');
  await page.getByRole('listitem').filter({ has: page.getByText('Квадрат', { exact: true }) }).getByRole('checkbox').check();

  // Chosen in the order Трикутник, Квадрат; moved up, Квадрат goes first.
  await page.getByRole('button', { name: 'Вище: Квадрат' }).click();
  await page.getByRole('button', { name: '15 хв' }).click();
  await expect(page.getByLabel('Обмеження часу (хв)')).toHaveValue('15');

  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  const square = await page.getByRole('button', { name: 'Квадрат', exact: true }).boundingBox();
  const triangle = await page.getByRole('button', { name: 'Трикутник', exact: true }).boundingBox();
  expect(square && triangle && square.y < triangle.y).toBe(true);
});

test('one session for several classes: each class gets its own code and only its own roster', async ({ page }) => {
  await loginAsTeacher(page);
  // A second class of the demo teacher's, made through the UI.
  const otherClass = `Паралельний клас ${Date.now()}`;
  await page.getByRole('link', { name: 'Новий клас' }).click();
  await page.getByLabel('Назва класу').fill(otherClass);
  await page.getByLabel('Додати учня').fill('Остап');
  await page.getByLabel('Додати учня').press('Enter');
  await page.getByRole('button', { name: 'Створити клас' }).click();
  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();

  await page.getByRole('link', { name: 'Нове заняття' }).first().click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await expect(page.getByTestId('routes-panel')).toBeVisible();
  await page.getByRole('group', { name: 'Також для класів' }).getByLabel(otherClass).check();
  // Routes name one roster's students, so they step aside.
  await expect(page.getByTestId('multi-class-note')).toContainText('Класів: 2');
  await expect(page.getByTestId('routes-panel')).toHaveCount(0);

  await page.getByLabel('Пошук').fill('квадрат');
  await page.getByRole('listitem').filter({ has: page.getByText('Квадрат', { exact: true }) }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. У кожного класу свій код:')).toBeVisible({ timeout: 10_000 });

  const rows = page.getByTestId('created-sessions').getByRole('listitem');
  await expect(rows).toHaveCount(2);
  const codeOf = async (title: string) =>
    ((await rows.filter({ hasText: title }).locator('.font-mono').textContent()) ?? '').trim();
  const demoCode = await codeOf('Демонстраційний клас');
  const otherCode = await codeOf(otherClass);
  expect(demoCode).toMatch(/^[A-Z2-9]{6}$/);
  expect(otherCode).toMatch(/^[A-Z2-9]{6}$/);
  expect(otherCode).not.toBe(demoCode);

  await page.goto(`/s/${otherCode.toLowerCase()}`);
  await expect(page.getByRole('button', { name: 'Остап' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Олена' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Остап' }).click();
  await expect(page.getByRole('button', { name: 'Квадрат', exact: true })).toBeVisible();

  await page.goto(`/s/${demoCode.toLowerCase()}`);
  await expect(page.getByRole('button', { name: 'Олена' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Остап' })).toHaveCount(0);
});

test('graded and homework sessions explain the grade, and warn when 10–12 is out of reach', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).first().click();
  // Practice is never graded: nothing to explain.
  await expect(page.getByTestId('grade-band-note')).toHaveCount(0);

  await page.locator('#mode').selectOption('graded');
  const note = page.getByTestId('grade-band-note');
  await expect(note).toBeVisible();
  // Nothing chosen yet: the explanation, no warning.
  await expect(page.getByTestId('grade-band-warning')).toHaveCount(0);

  // Only an easy task: the best grade is 9, and the builder says so.
  await page.getByLabel('Пошук').fill('квадрат');
  await page.getByRole('listitem').filter({ has: page.getByText('Квадрат', { exact: true }) }).getByRole('checkbox').check();
  await expect(page.getByTestId('grade-band-warning')).toContainText('найвища можлива оцінка — 9');

  await note.locator('summary').click();
  await expect(note).toContainText('Оцінки 10–12 — лише для учня, який повністю розв\'язав хоча б одне завдання складності 4–5');
  await expect(note).not.toContainText('Перевірка в класі');

  // Homework adds the first-Check rule, improvement tasks and the class check.
  await page.locator('#mode').selectOption('homework');
  await expect(note).toContainText('Виправлення (друга чи третя перевірка) приносить 70% балів, але 10–12 не відкриває');
  await expect(note).toContainText('Перевірка в класі оцінку не підвищує');

  // A difficulty 5 task opens the band: the warning goes.
  await page.getByLabel('Пошук').fill('вид трикутника');
  await page.getByRole('listitem').filter({ has: page.getByText('Вид трикутника', { exact: true }) }).getByRole('checkbox').check();
  await expect(page.getByTestId('grade-band-warning')).toHaveCount(0);
});
