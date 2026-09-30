import { expect, test } from '@playwright/test';

/**
 * The workspace frame every task type shares (components/task/WorkspaceFrame.tsx):
 * where the task sits in its lesson, the lesson's theory kept collapsed until
 * asked for, and predict answering on Enter.
 */

test('a lesson task says where it sits and keeps the lesson theory one click away', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle/g7-turtle-square');
  await expect(page.getByRole('heading', { name: 'Квадрат', exact: true })).toBeVisible();
  await expect(page.getByText('Завдання 1 з 3')).toBeVisible();

  // Collapsed by default: the statement is what the student reads first.
  const theory = page.getByRole('button', { name: /Як це працює/ });
  await expect(theory).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByText('Основні команди:')).toHaveCount(0);

  await theory.click();
  await expect(theory).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Основні команди:')).toBeVisible();
});

test('a predict answer is checked with Enter', async ({ page }) => {
  await page.goto('/practice/g7-27-arithmetic/g7-predict-arithmetic');
  const answer = page.getByLabel('Що виведе ця програма?');
  await answer.fill('14');
  await answer.press('Enter');
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();
});

test('a pass opens the success panel in the task panel, with the way on focused', async ({ page }) => {
  await page.goto('/practice/g7-25-intro/g7-quiz-print-purpose');
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Перевірити' }).click();

  // The word appears once — in the panel — and the dock only notes the pass.
  await expect(page.getByRole('heading', { name: 'Готово!' })).toHaveCount(1);
  await expect(page.getByText('Перевірку пройдено.')).toBeVisible();
  // Enter moves on: the next step already has the focus.
  await expect(page.getByRole('link', { name: 'Перейти до наступного завдання', exact: true })).toBeFocused();
  // The task stays readable under it.
  await expect(page.getByRole('heading', { name: 'Навіщо потрібна функція print()', level: 1 })).toBeVisible();
});
