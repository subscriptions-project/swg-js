import {expect, test} from '@playwright/test';

test('has title', async ({page}) => {
  await page.goto('http://localhost:8080');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);
});

test('screenshot', async ({page}) => {
  await page.goto('http://localhost:8080');

  // Compare screenshot.
  await expect(page).toHaveScreenshot('homepage.png');
});
