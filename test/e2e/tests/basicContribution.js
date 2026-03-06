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
const {BasicContributionPage} = require('../pages/basicContribution');
const {test, expect} = require('@playwright/test');

test.describe('basic @basic', () => {
  test('Show button', async ({page, context}) => {
    const basic = new BasicContributionPage(page);

    await basic.navigate();
    await expect(basic.swgBasicButton).toBeAttached({timeout: 10000});
    await expect(basic.swgBasicButton).toBeVisible();
    await basic.swgBasicButton.click();

    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('basic-contribution.png', {
      fullPage: true,
    });

    await basic.viewContributionOffers();
    await expect(basic.priceChip).toContainText('$1');

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      basic.contribute(),
    ]);

    await newPage.waitForLoadState();
    await newPage.waitForTimeout(2000);
    await expect(newPage).toHaveURL(
      new RegExp('.*' + constants.google.domain + '.*')
    );
  });
});
