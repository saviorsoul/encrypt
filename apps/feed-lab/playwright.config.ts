import { defineConfig, devices } from '@playwright/test';

const PORT = 5174;
const baseURL = `https://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  globalTeardown: './e2e/fixtures/globalTeardown.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    ignoreHTTPSErrors: true,
  },
});
