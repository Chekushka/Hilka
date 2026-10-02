import { expect, test, type Browser, type Page } from '@playwright/test';

/**
 * Homework (docs/HOMEWORK.md): built in the session builder with a deadline
 * and an improvement task; a student who fails a first Check gets two fixes at
 * 70%, then the improvement task appears; everything survives a reload; the
 * server refuses a Check the rules do not allow; and a second device under the
 * same name is shown to the student and to the teacher, who can cancel what it
 * did. Quiz tasks throughout, so nothing waits for the Python engine.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const MAIN = 'Навіщо потрібна функція print()';
const MAIN_RIGHT = 'Виводить текст або значення на екран';
const MAIN_WRONG = 'Зчитує число від користувача';
const IMPROVEMENT = "Правильне ім'я змінної";
const IMPROVEMENT_RIGHT = 'x1';

/** A task's row in the room's list: its title, then its status. */
const taskRow = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered — is the browser job unset from Vercel?');
  await page.goto(href);
}

/** Builds a homework through the real form; returns its code and the session page's URL. */
async function buildHomework(page: Page): Promise<{ code: string; sessionUrl: string }> {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption('homework');
  // Three days out by default; the rules are spelled out for the teacher.
  await expect(page.getByLabel('Здати до')).not.toHaveValue('');
  await expect(page.getByTestId('homework-rules')).toContainText('70%');

  for (const title of [MAIN, IMPROVEMENT]) {
    await page.locator('#taskSearch').fill(title);
    await page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) }).getByRole('checkbox').check();
  }
  await page.getByRole('button', { name: `Завдання для покращення оцінки: ${IMPROVEMENT}` }).click();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/^Здати до:/)).toBeVisible();
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
  const sessionUrl = (await page.getByRole('link', { name: 'Переглянути заняття' }).getAttribute('href')) ?? '';
  return { code, sessionUrl };
}

async function joinAs(browser: Browser, code: string, name: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`/s/${code.toLowerCase()}`);
  await expect(page.getByTestId('device-notice')).toBeVisible();
  await expect(page.getByTestId('homework-deadline')).toContainText('Здати до');
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  return page;
}

async function answer(page: Page, option: string) {
  await page.getByLabel(option, { exact: true }).check();
  await page.getByRole('button', { name: 'Перевірити' }).click();
}

test('a failed first Check can be fixed twice for 70%, then the improvement task appears and the state survives a reload', async ({
  browser,
  page
}) => {
  const { code } = await buildHomework(page);
  const student = await joinAs(browser, code, 'Олена');

  // Nothing lost yet: no improvement task.
  await expect(student.getByRole('heading', { name: 'Завдання для покращення оцінки' })).toHaveCount(0);

  await student.getByRole('button', { name: MAIN, exact: true }).click();
  await expect(student.getByText(/Зараховується перша перевірка/)).toBeVisible();
  await answer(student, MAIN_WRONG);
  await expect(student.getByTestId('fixes-left')).toContainText('залишилось перевірок — 2');

  // The pass is kept to be replayed below: the server must refuse it a second time.
  const passing = student.waitForRequest((request) => request.url().endsWith('/api/attempts'));
  await answer(student, MAIN_RIGHT);
  const passingBody = (await passing).postData() ?? '';
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await student.getByRole('button', { name: '← До списку завдань' }).first().click();

  await expect(taskRow(student, MAIN)).toContainText(
    'Виправлено · 70%'
  );
  await expect(student.getByRole('heading', { name: 'Завдання для покращення оцінки' })).toBeVisible();

  // Survives a reload: the room reads the attempts back from the server.
  await student.reload();
  await expect(student.getByRole('heading', { name: 'Завдання для покращення оцінки' })).toBeVisible();
  await student.getByRole('button', { name: IMPROVEMENT, exact: true }).click();
  await expect(student.getByText(/зараховується лише перша перевірка/)).toBeVisible();
  await answer(student, IMPROVEMENT_RIGHT);
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();

  // Reopening a counted task shows it as counted, not a fresh task.
  await student.getByRole('button', { name: '← До списку завдань' }).first().click();
  await taskRow(student, MAIN).click();
  await expect(student.getByRole('heading', { name: 'Зараховано' })).toBeVisible();
  await expect(student.getByText('Зараховано після виправлення — на 70%.')).toBeVisible();

  // The server refuses a Check the rules do not allow, whatever the room shows.
  const refused = await student.evaluate(
    (body) =>
      fetch('/api/attempts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then(
        (response) => response.status
      ),
    passingBody
  );
  expect(refused).toBe(409);
  await student.context().close();
});

test('a second device under the same name is shown to the student and the teacher, who can cancel what it did', async ({
  browser,
  page
}) => {
  const { code, sessionUrl } = await buildHomework(page);

  // Someone else opens Тарас first and fails his first Check.
  const intruder = await joinAs(browser, code, 'Тарас');
  await intruder.getByRole('button', { name: MAIN, exact: true }).click();
  await answer(intruder, MAIN_WRONG);
  await expect(intruder.getByTestId('fixes-left')).toBeVisible();
  await intruder.context().close();

  // The real Тарас, on his own device, is told — calmly — and sees the used try.
  const taras = await joinAs(browser, code, 'Тарас');
  await expect(taras.getByTestId('used-elsewhere')).toBeVisible();
  const mainButton = taskRow(taras, MAIN);
  await expect(mainButton).toContainText('Можна виправити: ще 2');

  // He makes one Check of his own, so both devices have worked under his name.
  await mainButton.click();
  await answer(taras, MAIN_WRONG);
  await expect(taras.getByTestId('fixes-left')).toContainText('залишилось перевірок — 1');

  // The teacher sees two devices, and cancels the first one's attempts on the card.
  // In-page, not page.goto: the teacher's cookie lives on the origin the login landed on
  // (AI_CONTEXT.md, Gotchas, `request.url`).
  await page.evaluate((url) => window.location.assign(url), sessionUrl);
  await expect(page.getByTestId('homework-due')).toBeVisible();
  const row = page.locator('tr', { has: page.getByRole('link', { name: /Тарас/ }) });
  await expect(row.getByTestId('devices-many')).toHaveText('2');
  await row.getByRole('link', { name: /Тарас/ }).click();
  await expect(page.getByTestId('student-devices')).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Скасувати спроби пристрою 1' }).click();
  await expect(page.getByText('скасовано', { exact: true })).toBeVisible();

  // Тарас's own Check is now his first; the cancelled one no longer counts.
  await taras.reload();
  await expect(
    taskRow(taras, MAIN)
  ).toContainText('Можна виправити: ще 2');
  await taras.context().close();
});

test('a deadline moved into the past tells students their work now counts for 70%, and marks it late for the teacher', async ({
  browser,
  page
}) => {
  const { code, sessionUrl } = await buildHomework(page);
  await page.evaluate((url) => window.location.assign(url), sessionUrl);
  await expect(page.getByTestId('homework-due')).toBeVisible();

  // Yesterday, on the browser's own clock: less than two days late.
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}T${pad(yesterday.getHours())}:${pad(yesterday.getMinutes())}`;
  await page.getByLabel('Термін здачі').fill(local);
  await page.getByRole('button', { name: 'Змінити термін' }).click();
  await expect(page.getByTestId('homework-due')).toContainText('тому');

  const student = await joinAs(browser, code, 'Соломія');
  await expect(student.getByTestId('homework-late')).toContainText('70%');
  await student.getByRole('button', { name: MAIN, exact: true }).click();
  await answer(student, MAIN_RIGHT);
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await student.context().close();

  await page.reload();
  const row = page.locator('tr', { has: page.getByRole('link', { name: /Соломія/ }) });
  await expect(row).toContainText('після терміну: 1');
});

test('a graded lesson keeps a task locked to its first Check across a reload', async ({ browser, page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption('graded');
  await page.locator('#taskSearch').fill(MAIN);
  await page.getByRole('listitem').filter({ has: page.getByText(MAIN, { exact: true }) }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name: 'Олена', exact: true }).click();
  await student.getByRole('button', { name: MAIN, exact: true }).click();
  await answer(student, MAIN_WRONG);
  await expect(student.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();

  // Before, a reload forgot the lock and handed back a fresh task.
  await student.reload();
  await taskRow(student, MAIN).click();
  await expect(student.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await expect(student.getByRole('button', { name: 'Перевірити' })).toHaveCount(0);
  await student.context().close();
});

test('a class check that the student fails lowers that homework task to 70%; one they skip changes nothing', async ({
  browser,
  page
}) => {
  const { code, sessionUrl } = await buildHomework(page);

  // At home, Олена and Соломія both pass the main task on the first Check.
  for (const name of ['Олена', 'Соломія']) {
    const student = await joinAs(browser, code, name);
    await student.getByRole('button', { name: MAIN, exact: true }).click();
    await answer(student, MAIN_RIGHT);
    await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
    await student.context().close();
  }

  // One easy task, solved in full: 100%, held at 9 by the high-band rule.
  await page.evaluate((url) => window.location.assign(url), sessionUrl);
  const row = (name: string) => page.locator('tr', { has: page.getByRole('link', { name: new RegExp(name) }) });
  await expect(row('Олена').locator('td').last()).toContainText('9');

  // The teacher creates a class check of it.
  const panel = page.getByTestId('class-check');
  await expect(panel.getByLabel(MAIN)).toBeChecked();
  await panel.getByRole('button', { name: 'Створити перевірку' }).click();
  const checkCode = ((await panel.getByTestId('check-code').textContent()) ?? '').trim();
  expect(checkCode).toMatch(/^[A-Z2-9]{6}$/);

  // In class, Олена fails it; Соломія is absent.
  const inClass = await (await browser.newContext()).newPage();
  await inClass.goto(`/s/${checkCode.toLowerCase()}`);
  await expect(inClass.getByTestId('check-notice')).toContainText('70%');
  await inClass.getByRole('button', { name: 'Олена', exact: true }).click();
  await inClass.getByRole('button', { name: MAIN, exact: true }).click();
  await answer(inClass, MAIN_WRONG);
  await expect(inClass.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await inClass.context().close();

  // Олена's task drops to 70% → 8; Соломія keeps her 9.
  await page.reload();
  await expect(row('Олена')).toContainText('перевірка: ✓ 0 з 1');
  await expect(row('Олена').locator('td').last()).toContainText('8');
  await expect(row('Соломія').locator('td').last()).toContainText('9');
  await expect(row('Соломія')).not.toContainText('перевірка');

  // The card says why; the check's own page has no grade and points back here.
  await row('Олена').getByRole('link', { name: /Олена/ }).click();
  await expect(page.getByTestId('check-result')).toContainText('зараховано на 70%');
  await page.getByRole('link', { name: /^← / }).first().click();
  await page.getByTestId('class-check').getByRole('link', { name: new RegExp(checkCode) }).click();
  await expect(page.getByTestId('check-of')).toBeVisible();
  await expect(page.getByText('Орієнтовна оцінка')).toHaveCount(0);
});
