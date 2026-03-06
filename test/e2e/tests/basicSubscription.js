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

const constants = require('../constants');
const {BasicSubscriptionPage} = require('../pages/basicSubscription');
const {test, expect} = require('@playwright/test');

test.describe('basic @basic', () => {
  test('Subscribe', async ({page, context}) => {
    const basic = new BasicSubscriptionPage(page);

    await basic.navigate();

    await expect(basic.swgBasicButton).toBeAttached({timeout: 10000});
    await expect(basic.swgBasicButton).toBeVisible();
    await basic.swgBasicButton.click();

    // Pause for animations/loading to finish
    await page.waitForTimeout(3000);

    // Visual Regression Test using Playwright native
    await expect(page).toHaveScreenshot('basic-subscription.png', {
      fullPage: true,
    });

    await basic.viewSubscriptionOffers();
    await expect(basic.subscriptionHeader).toContainText(
      'Swgjs Subscription Demos'
    );

    // We expect basic.subscribe() to open a new tab/popup for Google Pay
    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      basic.subscribe(),
    ]);

    await newPage.waitForLoadState();

    // Equivalent of checkPayment()
    await newPage.waitForTimeout(2000);
    await expect(newPage).toHaveURL(
      new RegExp('.*' + constants.google.domain + '.*')
    );
  });
});
