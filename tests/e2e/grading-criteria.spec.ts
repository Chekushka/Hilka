import { expect, test, type Page } from '@playwright/test';
import { confirmHandIn } from './hand-in';

/**
 * What a student is shown before a graded task (docs/AI_CONTEXT.md, "Grading"):
 * the rules and the scale above the task list, each task's level and points,
 * the task's own criteria generated from its checks and cases — visible cases
 * by label, hidden ones only counted — and a question in the middle of the
 * screen before a Check that counts. Saying no hands nothing in.
 */

const TEACHER_EMAIL = 'demo-teacher@hilka.dev';
const COUNTDOWN = 'Зворотний відлік';
const QUIZ = 'Навіщо потрібна функція print()';
const QUIZ_RIGHT = 'Виводить текст або значення на екран';

const taskRow = (page: Page, title: string) =>
  page.getByRole('button', { name: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) });

const go = (page: Page, path: string) => page.goto(new URL(path, page.url()).toString());

async function loginAsTeacher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Електронна пошта').fill(TEACHER_EMAIL);
  await page.getByRole('button', { name: 'Надіслати посилання' }).click();
  const href = await page.getByRole('link', { name: /\/api\/auth\/verify\?token=/ }).getAttribute('href');
  if (!href) throw new Error('no devLoginUrl link rendered');
  await page.goto(href);
}

async function buildSession(page: Page, mode: 'graded' | 'practice'): Promise<string> {
  await loginAsTeacher(page);
  await go(page, '/sessions/new');
  await page.locator('#class').selectOption({ label: 'Демонстраційний клас' });
  await page.getByLabel('Режим').selectOption(mode);
  for (const title of [QUIZ, COUNTDOWN]) {
    await page.locator('#taskSearch').fill(title);
    await page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) }).getByRole('checkbox').check();
  }
  await page.getByRole('button', { name: 'Створити заняття' }).click();
  await expect(page.getByText('Заняття створено. Код для учнів:')).toBeVisible({ timeout: 10_000 });
  return ((await page.locator('p.font-mono.text-2xl').textContent()) ?? '').trim();
}

test('a graded lesson shows its rules, scale and criteria, and asks before every Check that counts', async ({
  browser,
  page
}) => {
  const code = await buildSession(page, 'graded');
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name: 'Олена', exact: true }).click();

  // The rules and the scale, open before anything is handed in.
  const rules = student.getByTestId('grading-rules');
  await expect(rules).toHaveAttribute('open', '');
  await expect(rules).toContainText('Як оцінюється це заняття');
  await expect(rules).toContainText('зараховується перша спроба');
  await expect(rules).toContainText('легке — 1 бал, середнє — 2 бали, складне — 3 бали');
  // No hard task here: the session says the top it can reach.
  await expect(rules).toContainText('найвища можлива оцінка — 9');
  const scale = student.getByTestId('grading-scale');
  await expect(scale).toContainText('Високий');
  await expect(scale.getByRole('term').last()).toHaveText('Оцінка 12');
  await expect(scale.getByRole('definition').last()).toHaveText('91,7–100%');
  await expect(taskRow(student, QUIZ).getByTestId('task-worth')).toHaveText(' · легке, 1 бал');

  // The task's own criteria: cases by label, the hidden one only counted.
  await taskRow(student, COUNTDOWN).click();
  const criteria = student.getByTestId('task-criteria');
  await expect(criteria).toContainText('Це легке завдання — 1 бал.');
  await expect(criteria).toContainText('Приклади: з 5.');
  await expect(criteria).toContainText('Прихованих прикладів: 1.');
  await expect(criteria).not.toContainText('з 1');
  await expect(criteria).toContainText('Важливе правильне число');

  // Saying no hands nothing in.
  await expect(student.getByRole('button', { name: 'Здати' })).toBeEnabled({ timeout: 30_000 });
  let posted = 0;
  student.on('request', (request) => {
    if (request.url().includes('/api/attempts') && request.method() === 'POST') posted += 1;
  });
  await student.getByRole('button', { name: 'Здати' }).click();
  const dialog = student.getByRole('dialog', { name: 'Здати завдання?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('confirm-check-note')).toContainText('Це твоя єдина спроба');
  await expect(dialog).toContainText('Завдання коштує 1 бал.');
  await expect(dialog).toContainText('Прихованих прикладів: 1.');
  // Focus waits on "keep working", so an Enter out of habit does not hand in.
  await expect(dialog.getByRole('button', { name: 'Ще попрацюю' })).toBeFocused();
  await student.keyboard.press('Enter');
  await expect(dialog).toBeHidden();
  await student.getByRole('button', { name: 'Здати' }).click();
  await student.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(student.getByTestId('workspace-checks-left')).toHaveText('Спроб: 1');
  expect(posted).toBe(0);

  // A yes hands in, once, and the task locks.
  await student.getByRole('button', { name: '← До списку завдань' }).click();
  await taskRow(student, QUIZ).click();
  await student.getByLabel(QUIZ_RIGHT, { exact: true }).check();
  await student.getByRole('button', { name: 'Здати' }).click();
  await confirmHandIn(student);
  await expect(student.getByRole('heading', { name: 'Завдання здано' })).toBeVisible();
  await expect.poll(() => posted).toBe(1);

  // Once something is handed in, the rules fold away above the list.
  await student.getByRole('button', { name: '← До списку завдань' }).click();
  await expect(rules).not.toHaveAttribute('open', '');
  await student.context().close();
});

test('a practice session explains no grade and hands in without asking', async ({ browser, page }) => {
  const code = await buildSession(page, 'practice');
  const student = await (await browser.newContext()).newPage();
  await student.goto(`/s/${code.toLowerCase()}`);
  await student.getByRole('button', { name: 'Тарас', exact: true }).click();
  await expect(student.getByRole('heading', { name: 'Завдання заняття' })).toBeVisible();
  await expect(student.getByTestId('grading-rules')).toHaveCount(0);
  await expect(taskRow(student, QUIZ).getByTestId('task-worth')).toHaveCount(0);

  await taskRow(student, QUIZ).click();
  await expect(student.getByTestId('task-criteria')).toHaveCount(0);
  await student.getByLabel(QUIZ_RIGHT, { exact: true }).check();
  await student.getByRole('button', { name: 'Здати' }).click();
  await expect(student.getByRole('heading', { name: 'Готово!' })).toBeVisible();
  await expect(student.getByRole('dialog')).toHaveCount(0);
  await student.context().close();
});
