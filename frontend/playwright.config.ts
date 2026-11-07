import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const database = join(mkdtempSync(join(tmpdir(), 'byebye-e2e-')), 'workspace.db');
const python = process.env.TEST_PYTHON ?? '../.venv/bin/python';
const env = { DATABASE_PATH: database, GEMINI_API_KEY: '', APP_TOKEN: '' };

export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://localhost:3000', viewport: { width: 1440, height: 1100 }, trace: 'retain-on-failure' },
  webServer: [
    { command: `${python} -m uvicorn app.main:app --port 8000`, cwd: '../backend',
      env, url: 'http://localhost:8000/health', reuseExistingServer: false },
    { command: `${python} -m app.worker`, cwd: '../backend', env, timeout: 10000,
      wait: { stdout: /Worker ready/ }, reuseExistingServer: false },
    { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: false },
  ],
});
