/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const {SmartButtonPage} = require('../pages/smartButton');
const {test, expect} = require('@playwright/test');

test.describe('smart @smart', () => {
  test('Show Smart Button', async ({page}) => {
    const smartButton = new SmartButtonPage(page);

    await smartButton.navigate();

    await expect(smartButton.smartButtonWrapper).toBeAttached({timeout: 10000});

    // Switch to iframe and check button label
    await expect(smartButton.smartButtonLabel).toBeAttached();
    await expect(smartButton.smartButtonLabel).toHaveAttribute(
      'aria-label',
      /Subscribe with Google/
    );

    // Check message
    await expect(smartButton.subscribeMessage).toBeVisible();
  });

  test('Show offers after clicking smart button', async ({page}) => {
    const smartButton = new SmartButtonPage(page);

    await smartButton.navigate();

    await smartButton.smartButtonLabel.click();

    // In Playwright, clicks resolve successfully if status is roughly equivalent to 0.
    // If it doesn't fail, the click was successful.
  });
});
