import { defineConfig } from '@playwright/test';

// Explicit opt-in: this check calls the deployed Gemini provider and consumes credits.
export default defineConfig({
  testDir: './tests', testMatch: '**/deployment.spec.ts', workers: 1, timeout: 300000,
  use: {
    baseURL: process.env.DEPLOYMENT_URL ?? 'https://byebye.fyi',
    viewport: { width: 1440, height: 1000 }, trace: 'retain-on-failure',
  },
});
