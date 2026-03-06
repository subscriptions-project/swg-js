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

const {expect} = require('@playwright/test');
const {swgPageUrl} = require('../util');

class BasicContributionPage {
  constructor(page) {
    this.page = page;
    this.swgBasicButton = page.locator('.swg-button-v2-dark');

    this.offersIframe = page
      .frameLocator('iframe[src*="about:blank"]')
      .frameLocator('iframe[src*="contributionoffersiframe"]');
    this.contributeBtn = this.offersIframe.locator('.PNojLb button').first();
    this.priceChip = this.offersIframe.locator('.h57Fgb').first();
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      '/demos/public/button-dark.html',
      experiments
    );
    await this.page.goto(url);
  }

  async viewContributionOffers() {
    await this.page.waitForTimeout(1000);
  }

  async contribute() {
    await expect(this.contributeBtn).toContainText('Contribute $1 / month');
    await this.contributeBtn.click();
  }
}

module.exports = {BasicContributionPage};
