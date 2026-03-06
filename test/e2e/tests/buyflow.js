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
const {PublicationPage} = require('../pages/publication');
const {test, expect} = require('@playwright/test');

test.describe('buyflow @buyflow', () => {
  test('Show offers on web', async ({page}) => {
    const publication = new PublicationPage(page);

    await publication.navigate();
    await publication.viewFirstArticle();

    await expect(publication.swgIFrame).toBeAttached({timeout: 10000});

    await page.waitForTimeout(3000);
    await expect(page).toHaveScreenshot('classic-susbcription.png', {
      fullPage: true,
    });

    await publication.viewOffers();
    await expect(publication.offerCarousel).toBeAttached();

    await expect(
      publication.offersIframe.locator('.K2Fgzb').first()
    ).toContainText('Subscribe with your Google Account');
    await expect(
      publication.offersIframe.locator('.wlhaj.I3RyHc').first()
    ).toContainText('Already subscribed?');
    await expect(
      publication.offersIframe.locator('.amekj').first()
    ).toContainText('Weekly');
    await expect(
      publication.offersIframe.locator('.e02Wob').first()
    ).toContainText('$9.99/week');
  });

  test('Selecting an offer triggers Google Sign-In prompt', async ({
    page,
    context,
  }) => {
    const publication = new PublicationPage(page);
    await publication.navigate();
    await publication.viewFirstArticle();

    const [newPage] = await Promise.all([
      context.waitForEvent('page'),
      publication.selectOffer(),
    ]);

    await newPage.waitForLoadState();
    await newPage.waitForTimeout(2000);
    await expect(newPage).toHaveURL(
      new RegExp('.*' + constants.google.domain + '.*')
    );
  });
});
