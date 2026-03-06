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

const {ExtendedAccessPage} = require('../pages/extendedAccess');
const {test, expect} = require('@playwright/test');

test.describe('extendedAccess @extendedAccess', () => {
  test('Show regwall', async ({page}) => {
    const extendedAccess = new ExtendedAccessPage(page);

    await extendedAccess.navigate();
    await expect(extendedAccess.swgRegwallDialog).toBeAttached({
      timeout: 10000,
    });
    await expect(extendedAccess.swgRegwallDialog).toBeVisible();
    await page.waitForTimeout(3000);

    await expect(page).toHaveScreenshot('regwall.png', {fullPage: true});

    await expect(extendedAccess.title).toContainText('Get more with Google');
    await expect(extendedAccess.description).toContainText(
      'This content usually requires payment'
    );
  });
});
