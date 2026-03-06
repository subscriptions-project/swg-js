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

class PublicationPage {
  constructor(page) {
    this.page = page;
    this.swgIFrame = page.locator('iframe.swg-dialog').first();
    this.offersIframe = page
      .frameLocator('iframe[src*="about:blank"]')
      .frameLocator('iframe[src*="offersiframe"]');
    this.offerCarousel = this.offersIframe.locator('.K2Fgzb').first();
    this.basicAccessOffer = this.offersIframe.locator('.qLPyoc').first();
  }

  getPath() {
    return '/examples/sample-pub/1';
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      this.getPath(),
      experiments
    );
    await this.page.goto(url);
  }

  async viewFirstArticle() {
    await this.page.waitForTimeout(1000);
    await expect(this.page).toHaveTitle('16 Top Spots for Hiking - The Scenic');
  }

  async viewOffers() {
    await this.page.waitForTimeout(1000);
  }

  async selectOffer() {
    await this.viewOffers();
    await expect(this.basicAccessOffer).toBeAttached();
    await this.basicAccessOffer.click();
    await this.page.waitForTimeout(1000);
  }
}

module.exports = {PublicationPage};
