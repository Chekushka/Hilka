import { expect, test } from '@playwright/test';

/**
 * app/error.tsx — the calm Ukrainian screen a student (or teacher) sees
 * when something below the root layout throws unexpectedly, most notably a
 * Neon connection failure mid-lesson (docs/TASKS.md Open Questions).
 * app/(dev)/error-boundary/ throws on purpose so this is deterministic,
 * rather than actually taking down the shared database other specs use.
 */

test('an unexpected server error renders the calm Ukrainian boundary, not a raw error page', async ({ page }) => {
  await page.goto('/error-boundary');
  await expect(page.getByRole('heading', { name: 'Щось пішло не так' })).toBeVisible();
  await expect(page.getByText(/Спробуй ще раз за хвилину/)).toBeVisible();
  // Never a raw stack trace or an English default page reaching the student.
  await expect(page.getByText('deliberate failure for testing')).toHaveCount(0);
});

test('the boundary offers a retry that re-runs the failing render', async ({ page }) => {
  await page.goto('/error-boundary');
  const retry = page.getByRole('button', { name: 'Спробувати ще раз' });
  await expect(retry).toBeVisible();
  // The dev page always throws, so retrying lands on the same calm screen
  // again rather than crashing the browser tab.
  await retry.click();
  await expect(page.getByRole('heading', { name: 'Щось пішло не так' })).toBeVisible();
});
