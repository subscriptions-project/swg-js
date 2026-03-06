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

const {EnterpriseNewsletterPage} = require('../pages/enterpriseNewsletter');
const {test, expect} = require('@playwright/test');

test.describe('enterprise @enterprise', () => {
  test('Enterprise Newsletter', async ({page}) => {
    const basic = new EnterpriseNewsletterPage(page);

    await basic.navigate();
    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('enterprise-newsletter.png', {
      fullPage: true,
    });

    await basic.viewNewsletter();
    await expect(basic.newsletterHeader).toContainText(
      'Enterprise Contribution E2E Test Pub'
    );
    await expect(basic.consentMessage).toContainText(
      'I consent to this newsletter.'
    );

    await basic.consentToNewsletter();

    await basic.optInAction();
    await page.waitForTimeout(2000);
  });
});
