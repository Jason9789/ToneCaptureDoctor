import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/pwa.spec.ts',
  reporter: 'html',
  use: {
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: !process.env.CI,
  },
});
