const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/responsive.spec.cjs',
  timeout: 90000,
  expect: { timeout: 10000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    browserName: 'chromium',
    baseURL: process.env.GMA_STORE_URL || 'https://rnqe6b-aj.myshopify.com',
    actionTimeout: 12000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 30000,
  },
});
