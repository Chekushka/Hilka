import { expect, test } from '@playwright/test';

/**
 * The workspace frame every task type shares (components/task/WorkspaceFrame.tsx):
 * where the task sits in its lesson, the lesson's theory kept collapsed until
 * asked for, predict answering on Enter, and a pass that can be seen and acted
 * on from wherever the student is looking.
 */

test('a lesson task says where it sits and keeps the lesson theory one click away', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle/g7-turtle-square');
  await expect(page.getByRole('heading', { name: 'Квадрат', exact: true })).toBeVisible();
  await expect(page.getByText('Завдання 1 з 5')).toBeVisible();

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
  await page.getByRole('button', { name: 'Здати' }).click();

  // One heading — in the panel; the dock notes the pass (and its bar carries the way on, tested below).
  await expect(page.getByRole('heading', { name: 'Готово!' })).toHaveCount(1);
  await expect(page.getByText('Здано — усе правильно.')).toBeVisible();
  // Enter moves on: the next step already has the focus.
  await expect(page.getByRole('link', { name: 'Перейти до наступного завдання', exact: true })).toBeFocused();
  // The task stays readable under it.
  await expect(page.getByRole('heading', { name: 'Навіщо потрібна функція print()', level: 1 })).toBeVisible();
});

test('after a pass the way on also sits on the dock bar, where Check was pressed', async ({ page }) => {
  await page.goto('/practice/g7-25-intro/g7-quiz-print-purpose');
  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeVisible();

  const panelLink = page.getByRole('link', { name: 'Перейти до наступного завдання', exact: true });
  const dockLink = page.getByRole('link', { name: 'Далі', exact: true });
  await expect(dockLink).toBeVisible();
  expect(await dockLink.getAttribute('href')).toBe(await panelLink.getAttribute('href'));

  await dockLink.click();
  await expect(page).toHaveURL(/\/practice\/g7-25-intro\/(?!g7-quiz-print-purpose)/);
});

test('a pass scrolls a scrolled-down task panel back to the success panel', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 600 });
  await page.goto('/practice/g7-25-intro/g7-quiz-print-purpose');
  await page.getByRole('button', { name: /Як це працює/ }).click();

  // The task panel scrolls on its own from lg; scroll it to the bottom, as a student reading the theory would.
  // Scroll anchoring then keeps the theory in place when the success panel opens above it, which pushes
  // the success panel out of view unless the pass scrolls back.
  const panel = page.locator('aside').first();
  await panel.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const scrolled = await panel.evaluate((el) => el.scrollTop);
  expect(scrolled, 'the theory must make the task panel scroll, or this test proves nothing').toBeGreaterThan(0);

  await page.getByLabel('Виводить текст або значення на екран').check();
  await page.getByRole('button', { name: 'Здати' }).click();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeInViewport({ ratio: 1 });
});
