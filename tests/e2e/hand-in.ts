import { expect, type Page } from '@playwright/test';

/**
 * The yes to the confirm question that opens over a Check that counts
 * (components/task/CheckGate.tsx). Call it right after pressing «Здати» in a
 * graded lesson, homework or class check — practice hands in without asking.
 */
export async function confirmHandIn(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Здати завдання?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Так, здаю' }).click();
  await expect(dialog).toBeHidden();
}
