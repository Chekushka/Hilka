import { defineConfig } from '@playwright/test';

/**
 * Runner integration tests. These execute real Python in a real Worker, so they
 * need a browser — CLAUDE.md asks for one test per curriculum construct.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: false,
  reporter: process.env.CI ? 'list' : 'line',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    // The environment ships Chromium at a fixed path; do not download another.
    launchOptions: process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {}
  },
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://127.0.0.1:3000/practice',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000
  }
});
