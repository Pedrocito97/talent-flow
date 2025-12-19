import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3000';
const STORAGE_STATE_PATH = './playwright-auth.json';

interface PageResult {
  url: string;
  status: 'success' | 'error' | 'warning';
  title?: string;
  errors: string[];
  warnings: string[];
  screenshotPath?: string;
}

async function checkPages() {
  const results: PageResult[] = [];

  console.log('Starting page check...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console errors
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    } else if (msg.type() === 'warning') {
      consoleWarnings.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(err.message);
  });

  // Login first
  console.log('Logging in...');
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#email', { timeout: 10000 });
    await page.fill('#email', 'admin@talentflow.com');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to complete
    await page.waitForURL(/.*(?<!login)/, { timeout: 15000 });

    // Wait for the page to actually load (not just redirect)
    await page.waitForTimeout(3000);

    // Take a screenshot to verify login worked
    await page.screenshot({ path: 'screenshots/after-login.png' });

    // Save the storage state for reuse
    await context.storageState({ path: STORAGE_STATE_PATH });

    // Check if we're actually logged in by looking for sidebar
    const sidebarVisible = await page.locator('text="Talent Flow"').isVisible();
    if (!sidebarVisible) {
      console.log('Warning: Sidebar not visible after login - may not be authenticated');
    }

    console.log('Login successful!\n');
  } catch (e: any) {
    console.error('Login failed:', e.message);
    // Take screenshot of login page for debugging
    await page.screenshot({ path: 'screenshots/login-error.png' });
    await browser.close();
    return;
  }

  // Pages to test
  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/pipelines', name: 'Pipelines' },
    { path: '/candidates', name: 'Candidates' },
    { path: '/search', name: 'Search' },
    { path: '/duplicates', name: 'Duplicates' },
    { path: '/import', name: 'Import' },
    { path: '/templates', name: 'Templates' },
    { path: '/settings', name: 'Settings' },
  ];

  for (const p of pages) {
    consoleErrors.length = 0;
    consoleWarnings.length = 0;

    console.log(`Testing ${p.name} (${p.path})...`);

    const result: PageResult = {
      url: p.path,
      status: 'success',
      errors: [],
      warnings: [],
    };

    try {
      const response = await page.goto(`${BASE_URL}${p.path}`, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      if (!response) {
        result.status = 'error';
        result.errors.push('No response received');
      } else if (response.status() >= 400) {
        result.status = 'error';
        result.errors.push(`HTTP ${response.status()}`);
      }

      // Wait a bit for any delayed errors
      await page.waitForTimeout(2000);

      // Get page title
      result.title = await page.title();

      // Check for error text on page
      const errorElements = await page.locator('text=/error|failed|500|404/i').count();
      if (errorElements > 0) {
        result.warnings.push(`Found ${errorElements} potential error texts on page`);
      }

      // Check for loading states stuck
      const loadingSpinners = await page.locator('.animate-spin').count();
      if (loadingSpinners > 0) {
        result.warnings.push(`${loadingSpinners} loading spinner(s) still visible`);
      }

      // Take screenshot
      const screenshotName = `screenshots/${p.name.toLowerCase().replace(/\s+/g, '-')}.png`;
      await page.screenshot({ path: screenshotName, fullPage: true });
      result.screenshotPath = screenshotName;

      // Copy console errors/warnings
      result.errors.push(...consoleErrors);
      result.warnings.push(...consoleWarnings);

      if (result.errors.length > 0) {
        result.status = 'error';
      } else if (result.warnings.length > 0) {
        result.status = 'warning';
      }

    } catch (e: any) {
      result.status = 'error';
      result.errors.push(e.message);
    }

    results.push(result);

    // Print result
    const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
    console.log(`  ${icon} ${p.name}: ${result.status}`);
    if (result.errors.length > 0) {
      result.errors.forEach((e) => console.log(`    Error: ${e.substring(0, 100)}`));
    }
    if (result.warnings.length > 0) {
      result.warnings.forEach((w) => console.log(`    Warning: ${w.substring(0, 100)}`));
    }
    console.log('');
  }

  await browser.close();

  // Summary
  console.log('\n========== SUMMARY ==========\n');

  const successCount = results.filter((r) => r.status === 'success').length;
  const warningCount = results.filter((r) => r.status === 'warning').length;
  const errorCount = results.filter((r) => r.status === 'error').length;

  console.log(`✅ Success: ${successCount}`);
  console.log(`⚠️  Warnings: ${warningCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('');

  if (errorCount > 0) {
    console.log('Pages with errors:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`  - ${r.url}`);
        r.errors.forEach((e) => console.log(`      ${e.substring(0, 150)}`));
      });
  }

  console.log('\nScreenshots saved to ./screenshots/');
}

checkPages().catch(console.error);
