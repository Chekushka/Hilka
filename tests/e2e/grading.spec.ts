import { expect, test, type Page } from '@playwright/test';

/**
 * Suggested grades in a graded session (docs/AI_CONTEXT.md, "Grading"): a
 * teacher builds a graded session, a student passes two of a task's three
 * input cases, and the dashboard suggests the grade that partial credit earns.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const TASK_TITLE = 'Більше з двох чисел';

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
}

async function typeSolution(page: Page, code: string) {
  const editor = page.locator('.cm-content');
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

test('partial credit in a graded session becomes a suggested grade', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Нове заняття' }).click();
  // Other specs create classes of their own in the shared database; the
  // demo class is the one whose roster (Олена, Тарас, Соломія) this relies on.
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption('graded');
  await page.getByLabel('Тема', { exact: true }).selectOption({ label: 'Розгалуження: умовний оператор if' });
  await page.getByRole('listitem').filter({ hasText: TASK_TITLE }).getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  const code = ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();

  // Prints the second number: right when it is bigger or equal, wrong when
  // the first is bigger — two of three cases.
  await page.goto(`/s/${code.toLowerCase()}`);
  await page.getByRole('button', { name: 'Олена' }).click();
  await page.getByRole('button', { name: TASK_TITLE }).click();
  await expect(page.getByRole('button', { name: 'Перевірити' })).toBeEnabled({ timeout: 30_000 });
  await typeSolution(page, 'a = int(input())\nb = int(input())\nprint(b)');
  const [attemptResponse] = await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/attempts') && response.request().method() === 'POST'),
    page.getByRole('button', { name: 'Перевірити' }).click()
  ]);
  expect(attemptResponse.status()).toBe(201);
  const body = attemptResponse.request().postDataJSON() as { passed: boolean; score: number };
  expect(body.passed).toBe(false);
  expect(body.score).toBeCloseTo(2 / 3);

  await loginAsTeacher(page);
  await page.getByRole('link', { name: new RegExp(code) }).click();
  await expect(page.getByRole('heading', { name: `Заняття ${code}` })).toBeVisible();

  const rollup = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Хто потребує допомоги' }) });
  await expect(rollup.getByRole('columnheader', { name: 'Орієнтовна оцінка' })).toBeVisible();
  // 2/3 of the task's one point is 67% — достатній, grade 8.
  await expect(rollup.locator('tr').filter({ hasText: 'Олена' }).getByTitle('0.7 з 1')).toHaveText('8');
  await expect(rollup.locator('tr').filter({ hasText: 'Тарас' }).getByLabel('Нічого не здано')).toBeVisible();
  // A difficulty-2 task alone can never open the high band, and the page says so.
  await expect(page.getByText('найвища можлива оцінка — 9')).toBeVisible();

  const gradesUrl = await page.getByRole('link', { name: 'Завантажити оцінки (CSV)' }).getAttribute('href');
  if (!gradesUrl) throw new Error('grades link rendered with no href');
  const csv = await page.evaluate(async (url) => (await fetch(url)).text(), gradesUrl);
  expect(csv).toContain('Олена,8,0.7/1');
  expect(csv).toContain('Тарас,,');
});
