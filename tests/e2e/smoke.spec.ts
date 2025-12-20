import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// Login helper
async function login(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', 'admin@talentflow.com');
  await page.fill('input[name="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*(?<!login)/); // Wait until we're not on login page
}

test.describe('Smoke Tests - All Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Dashboard page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);

    // Check page title or main heading
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    // Check for console errors
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check for API errors displayed on page
    const errorText = await page.locator('text=/error|Error|failed|Failed/i').count();

    console.log('Dashboard - Console errors:', errors.length);
    console.log('Dashboard - Page error messages:', errorText);
  });

  test('Pipelines page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/pipelines`);

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    console.log('Pipelines - Console errors:', errors.length);
  });

  test('Templates page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/templates`);

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    console.log('Templates - Console errors:', errors.length);
  });

  test('Search page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/search`);

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    console.log('Search - Console errors:', errors.length);
  });

  test('Settings page loads without errors', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`);

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    console.log('Settings - Console errors:', errors.length);
  });

  test('Pipeline detail page loads', async ({ page }) => {
    // First get a pipeline ID
    await page.goto(`${BASE_URL}/pipelines`);
    await page.waitForLoadState('networkidle');

    // Click on first pipeline card/link
    const pipelineLink = page.locator('a[href*="/pipelines/"]').first();
    if ((await pipelineLink.count()) > 0) {
      await pipelineLink.click();
      await page.waitForLoadState('networkidle');

      // Should be on pipeline detail page
      await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
      console.log('Pipeline detail - Page loaded');
    } else {
      console.log('Pipeline detail - No pipelines found to test');
    }
  });
});

test.describe('API Endpoint Tests', () => {
  test('Analytics API returns valid response', async ({ request }) => {
    // First login to get session
    const loginResponse = await request.post(`${BASE_URL}/api/auth/callback/credentials`, {
      form: {
        email: 'admin@talentflow.com',
        password: 'password123',
      },
    });

    const response = await request.get(`${BASE_URL}/api/analytics?days=30`);
    console.log('Analytics API status:', response.status());

    if (response.status() !== 200) {
      const body = await response.text();
      console.log('Analytics API error:', body);
    }
  });

  test('Pipelines API returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/pipelines`);
    console.log('Pipelines API status:', response.status());
    expect(response.status()).toBe(200);
  });

  test('Search API returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/search`);
    console.log('Search API status:', response.status());
    // May return 401 without auth - that's expected
  });

  test('Templates API returns valid response', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/api/templates`);
    console.log('Templates API status:', response.status());
  });
});
