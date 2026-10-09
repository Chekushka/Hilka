import { devices, expect, test } from '@playwright/test';

/**
 * A task solved start to finish on a phone (touch, `pointer: coarse`): the
 * editor's key bar supplies the colon and the indentation a phone keyboard
 * hides, Check stays reachable, the drawing fits the screen, and the success
 * panel — at the top of the page — is brought into view.
 */

// The device's browser type cannot be switched inside a file; only its screen and input are used.
const { defaultBrowserType: _browser, ...pixel } = devices['Pixel 7'];
void _browser;
test.use(pixel);

test('a turtle task is solvable with a phone keyboard and the key bar', async ({ page }) => {
  await page.goto('/practice/g7-29-turtle/g7-turtle-square');
  const check = page.getByRole('button', { name: 'Здати' });
  await expect(check).toBeEnabled({ timeout: 30_000 });

  // The drawing scales down to the screen rather than overflowing it.
  const canvas = await page.getByRole('img', { name: 'Твій малюнок' }).boundingBox();
  expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(page.viewportSize()!.width);

  const editor = page.locator('.cm-content');
  await editor.tap();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('import turtle\nfor i in range(4)');
  await page.getByRole('button', { name: 'Вставити :' }).tap();
  await page.keyboard.insertText('\nturtle.forward(100)');
  await page.getByRole('button', { name: 'Відступ вправо' }).tap();
  await page.keyboard.insertText('\nturtle.right(90)');
  await page.getByRole('button', { name: 'Відступ вправо' }).tap();
  await expect(editor).toContainText('for i in range(4):');

  // Check sits at the bottom of the screen while the student is in the code.
  await expect(check).toBeInViewport();
  await check.tap();
  await expect(page.getByRole('heading', { name: 'Готово!' })).toBeInViewport({ timeout: 20_000 });
  // The way on is also under the thumb, on the bar that held Check.
  await expect(page.getByRole('link', { name: 'Далі', exact: true })).toBeInViewport();
});
