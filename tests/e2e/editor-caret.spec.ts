import { expect, test } from '@playwright/test';

/**
 * The editor uses the browser's native caret, and CodeMirror's base theme
 * pins it black for an editor it does not know is dark — invisible on the
 * dark code background. The caret must follow the ink colour in both themes.
 */
for (const colorScheme of ['dark', 'light'] as const) {
  test(`the editor caret matches the text colour in the ${colorScheme} theme`, async ({ browser }) => {
    const page = await browser.newPage({ colorScheme });
    await page.goto('/practice/g7-29-turtle/g7-turtle-square');
    const content = page.locator('.cm-content');
    await content.click();
    const { caret, color } = await content.evaluate((element) => {
      const style = getComputedStyle(element);
      return { caret: style.caretColor, color: style.color };
    });
    expect(caret).toBe(color);
    await page.close();
  });
}
