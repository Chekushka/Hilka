import type { Page } from '@playwright/test';

/**
 * The checks and cases fields open in the visual builder
 * (components/authoring/ChecksField.tsx). Specs about saving and publishing
 * still type their checks as JSON, so they switch the field to JSON mode first;
 * tests/e2e/check-builder.spec.ts drives the builder itself.
 */
export async function useJsonMode(page: Page, field: 'checks' | 'cases') {
  await page.locator(`button[aria-controls="${field}"]`, { hasText: 'JSON' }).click();
}
