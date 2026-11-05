// Browser tests on an iPhone 14-sized screen.
// On GitHub they run in WebKit (Safari's engine). Locally, `npm run test:chrome` uses your installed Chrome
// (set CHROME_PATH if it isn't found), because WebKit has to be downloaded first (`npx playwright install webkit`).
const {defineConfig, devices} = require('@playwright/test');
const fs = require('node:fs');

const chromePath =
  process.env.CHROME_PATH ||
  ['/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {trace: 'retain-on-failure'},
  projects: [
    {name: 'iphone-webkit', use: {...devices['iPhone 14']}},
    {
      name: 'iphone-chrome',
      use: {
        ...devices['iPhone 14'],
        browserName: 'chromium',
        launchOptions: chromePath ? {executablePath: chromePath, args: ['--no-sandbox']} : {}
      }
    }
  ]
});
