import { defineConfig, devices } from '@playwright/test';
import { e2eEnv } from './e2e/support/env';

const launchOptions = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: e2eEnv.baseURL, serviceWorkers: 'block', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], launchOptions } },
    { name: 'mobile', use: { ...devices['Pixel 7'], launchOptions }, grep: /@smoke|@mobile/ },
  ],
  // Contra um deploy (E2E_BASE_URL definido) não sobe servidor local.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'npm run build && npm run start', url: e2eEnv.baseURL, reuseExistingServer: !process.env.CI, timeout: 300_000 },
});
