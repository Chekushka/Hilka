import { defineConfig } from 'vitest/config';

/**
 * Unit tests for the pure parts — lib/checker/ and lib/seed/ — which run in
 * node with no browser. The runner's integration tests execute real Python in
 * a real Worker and belong to Playwright; excluding tests/ keeps vitest from
 * picking them up.
 */
export default defineConfig({
  test: {
    include: ['lib/**/*.test.ts'],
    environment: 'node'
  }
});
