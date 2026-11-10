import { defineConfig, devices } from '@playwright/test';

// Runs against the production build (npm run build + vite preview).
// E2E_PORT=<n> serves on that port and never reuses a running server, so parallel worktrees stay isolated.
const customPort = process.env.E2E_PORT;
const PORT = customPort ? Number(customPort) : 4173;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    // All date math in the app uses local time; pin it so expected values are stable.
    timezoneId: 'Europe/Warsaw',
    locale: 'pl-PL',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], timezoneId: 'Europe/Warsaw', locale: 'pl-PL' } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI && !customPort,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
