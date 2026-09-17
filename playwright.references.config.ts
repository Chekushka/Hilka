import { defineConfig } from '@playwright/test';

/**
 * Reference-check run (npm run verify:references / reference-check.yml).
 *
 * A standalone config, not the shared playwright.config.ts, because that
 * config's webServer waits on /practice — which reads a task from the
 * database — and this run is specifically the one meant to work with no
 * DATABASE_URL at all, reading content/seed-tasks/*.json directly. It waits
 * on /runner instead, the same DB-free dev page the runner's own integration
 * tests use to drive Skulpt.
 */
export default defineConfig({
  testDir: './tests/references',
  timeout: 30_000,
  fullyParallel: false,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000/runner',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
