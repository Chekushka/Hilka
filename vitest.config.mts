import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the pure parts — lib/checker/ and lib/seed/ — which run in
 * node with no browser. The runner's integration tests execute real Python in
 * a real Worker and belong to Playwright; excluding tests/ keeps vitest from
 * picking them up.
 *
 * The `@/*` alias mirrors tsconfig.json's `paths` — without it, a value
 * import (not a type-only one, which the TS transform erases before
 * resolution matters) through `@/...` resolves fine in Next's own build but
 * fails here, as it did the moment a lib/ module first needed lib/i18n.ts's
 * `t()` at runtime.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url))
    }
  },
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node'
  }
});
