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

class ContributionPage {
  constructor(page) {
    this.page = page;
    this.swgDialog = page.locator('.swg-dialog').first();

    this.contributionsIframe = page
      .frameLocator('iframe[src*="about:blank"]')
      .frameLocator('iframe[src*="contributionsiframe"]');
    this.contributionBtn = this.contributionsIframe
      .locator('.ContributionButtonText')
      .first();
    this.header = this.contributionsIframe.locator('.K2Fgzb').first();
    this.priceItem = this.contributionsIframe.locator('.Borcjc').first();
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      '/examples/sample-pub/1?showContributionOptions',
      experiments
    );
    await this.page.goto(url);
  }

  async viewContributionOptions() {
    await this.page.waitForTimeout(1000);
  }

  async contribute() {
    await expect(this.contributionBtn).toContainText('Contribute $0.99/week');
    await this.contributionBtn.click();
  }
}

module.exports = {ContributionPage};
