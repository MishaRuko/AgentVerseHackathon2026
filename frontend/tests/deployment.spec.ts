import { expect, test } from '@playwright/test';
import { workspaceInfoSchema, workspaceSchema } from '../src/lib/schemas';

test('public HTTPS upload, parallel analysis, SSO, billing and AI filtering', async ({ page }) => {
  const response = await page.request.post('/api/backend/api/workspaces', {
    data: { name: `Deployment check ${Date.now()}` },
  });
  expect(response.ok()).toBeTruthy();
  const workspace = workspaceInfoSchema.parse(await response.json());
  try {
    await page.addInitScript((id) => localStorage.setItem('workspace-id', id), workspace.id);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'The subscription clean-up crew.' })).toBeVisible();
    await page.getByLabel('Upload subscription spreadsheets').setInputFiles({
      name: 'deployment-check.csv', mimeType: 'text/csv',
      buffer: Buffer.from('Service,Users,Monthly spend,Currency\nNotion,35,1050,GBP\nFinancial Times,,4000,GBP'),
    });
    await page.getByRole('button', { name: 'Find my savings' }).click();
    await expect(page.locator('.subscription-card')).toHaveCount(2);
    const notion = page.locator('.subscription-card').filter({ has: page.getByRole('heading', { name: 'Notion', exact: true }) });
    const ft = page.locator('.subscription-card').filter({ has: page.getByRole('heading', { name: 'Financial Times', exact: true }) });
    await expect(notion.getByText('Suggestion ready')).toBeVisible({ timeout: 180000 });
    await expect(ft.getByRole('button', { name: 'Get with SSO' })).toBeEnabled({ timeout: 180000 });
    await ft.getByRole('button', { name: 'Get with SSO' }).click();
    await expect(ft.getByText('Suggestion ready')).toBeVisible({ timeout: 90000 });
    const stateResponse = await page.request.get('/api/backend/api/workspace', {
      headers: { 'X-Workspace-ID': workspace.id },
    });
    expect(stateResponse.ok()).toBeTruthy();
    const state = workspaceSchema.parse(await stateResponse.json());
    expect(state.services).toHaveLength(2);
    expect(state.services.every((service) => service.status === 'suggestion')).toBeTruthy();
    const news = state.services.find((service) => service.name === 'Financial Times')!;
    expect(news.category).toBe('News');
    expect(news.user_source).toBe('SSO');
    expect(news.users).toBeGreaterThan(0);
    expect(news.users).toBeLessThanOrEqual(300);
    expect(news.recommendations.length).toBeGreaterThan(0);
    await page.getByRole('button', { name: 'View Financial Times subscription' }).click();
    const panel = page.getByRole('dialog');
    await expect(panel.locator('.source-tag').first()).toHaveText('SSO');
    if (await panel.getByRole('tab', { name: 'Yearly', exact: true }).count()) {
      await panel.getByRole('tab', { name: 'Yearly', exact: true }).click();
      await expect(panel.locator('.recommendation')).toContainText('paid yearly');
    }
    await page.screenshot({ path: 'test-results/deployment-public.png', animations: 'disabled' });
    await panel.getByLabel('Close subscription details').click();
    await expect(panel).toBeHidden();
    await page.getByRole('button', { name: 'Ask AI to filter' }).click();
    await page.getByLabel('Natural language filter request').fill(
      'Show news subscriptions with at most 100 users, monthly spend above £500 and at least £50 monthly savings',
    );
    await page.getByRole('button', { name: 'Apply filter' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Filters applied.' })).toBeVisible({ timeout: 60000 });
    await expect(page.locator('.subscription-card')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'View Financial Times subscription' })).toBeVisible();
    console.log(JSON.stringify({ services: state.services.length, sso_users: news.users,
      billing_options: news.recommendations.map((item) => item.billing_period),
      category: news.category, pending_jobs: state.pending_jobs }));
  } finally {
    const deleted = await page.request.delete(`/api/backend/api/workspaces/${workspace.id}`);
    expect(deleted.ok()).toBeTruthy();
  }
});
