// Browser tests of the main flow, on a phone and a desktop viewport (Chromium only, to keep CI quick).
// The app runs from source against E2E_DATABASE_URL; each test wipes the data first.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.E2E_PORT ?? 18090);

export default defineConfig({
  testDir: '.',
  // One database for all tests: run them one after the other.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never', outputFolder: '../playwright-report' }]] : 'list',
  outputDir: '../test-results',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'node --disable-warning=ExperimentalWarning server/index.ts',
    cwd: '..',
    url: `http://127.0.0.1:${port}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      PORT: String(port),
      AUTH_MODE: 'none',
      MIGRATE_ON_START: 'true',
      WEB_DIR: 'web/dist',
      DATABASE_URL: process.env.E2E_DATABASE_URL ?? 'postgres://overload:overload@127.0.0.1:5432/overload',
    },
  },
});
