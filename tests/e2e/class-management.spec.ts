import { expect, test, type Page } from '@playwright/test';

/**
 * Class + roster management (docs/TASKS.md, "Class + roster management"): a
 * teacher creates a class and roster from the UI, and can come back later to
 * rename it or edit the roster — without touching the database directly.
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

test('a teacher creates a class, then renames it and edits the roster', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Новий клас' }).click();
  await expect(page.getByRole('heading', { name: 'Новий клас' })).toBeVisible();

  const className = `Тестовий клас ${Date.now()}`;
  await page.getByLabel('Назва класу').fill(className);
  await page.getByLabel("Учні (одне ім'я на рядок)").fill('Іван\nМарія');
  await page.getByRole('button', { name: 'Створити клас' }).click();

  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  const classCard = page.getByRole('listitem').filter({ hasText: className });
  await expect(classCard).toBeVisible();
  await expect(classCard.getByText('Учні: Іван, Марія')).toBeVisible();

  await classCard.getByRole('link', { name: 'Редагувати' }).click();
  await expect(page.getByRole('heading', { name: `Редагування класу: ${className}` })).toBeVisible();
  const renamed = `${className} (перейменовано)`;
  await page.getByLabel('Назва класу').fill(renamed);
  await page.getByLabel("Учні (одне ім'я на рядок)").fill('Іван\nМарія\nПетро');
  await page.getByRole('button', { name: 'Зберегти' }).click();

  await expect(page.getByRole('heading', { name: 'Мої класи' })).toBeVisible();
  const renamedCard = page.getByRole('listitem').filter({ hasText: renamed });
  await expect(renamedCard).toBeVisible();
  await expect(renamedCard.getByText('Учні: Іван, Марія, Петро')).toBeVisible();
});

test('creating a class without a roster is rejected before it ever posts', async ({ page }) => {
  await loginAsTeacher(page);
  await page.getByRole('link', { name: 'Новий клас' }).click();
  await page.getByLabel('Назва класу').fill('Клас без учнів');
  await page.getByRole('button', { name: 'Створити клас' }).click();
  await expect(page.getByText('Додай хоча б одного учня.')).toBeVisible();
});

test('the new-class page requires a logged-in teacher', async ({ page }) => {
  await page.goto('/classes/new');
  await expect(page.getByRole('heading', { name: 'Вхід для вчителя' })).toBeVisible();
});
