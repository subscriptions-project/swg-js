import {expect, test} from '@playwright/test';

const URL = 'http://localhost:8000/examples/sample-pub/1';

test('has title', async ({page}) => {
  await page.goto(URL);

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle('16 Top Spots for Hiking - The Scenic');
});

test('screenshot', async ({page}) => {
  await page.goto(URL);

  // Wait a bit.
  await page.waitForTimeout(1000);

  // Compare screenshot.
  await expect(page).toHaveScreenshot('publication.png');
});
