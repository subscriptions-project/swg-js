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

const {swgPageUrl} = require('../util');

class EnterpriseNewsletterPage {
  constructor(page) {
    this.page = page;
    this.swgDialog = page.locator('.swg-dialog').first();

    this.newsletterIframe = page
      .frameLocator('iframe[src*="about:blank"]')
      .frameLocator('iframe[src*="newsletteriframe"]');
    this.consentCheckbox = this.newsletterIframe
      .locator('[jsname="ERYeZe"] input')
      .first();
    this.consentMessage = this.newsletterIframe
      .locator('[jsname="ERYeZe"] label')
      .first();
    this.newsletterHeader = this.newsletterIframe
      .locator('[jsname="ekWun"]')
      .first();
    this.optInButton = this.newsletterIframe
      .locator('[jsname="rANL7b"] button')
      .first();
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      '/examples/sample-pub/config/rrme-contributions-prod/1?showNewsletterSignup',
      experiments
    );
    await this.page.goto(url);
  }

  async viewNewsletter() {
    await this.page.waitForTimeout(1000);
  }

  async consentToNewsletter() {
    await this.consentCheckbox.click();
  }

  async optInAction() {
    await this.optInButton.click();
  }
}

module.exports = {EnterpriseNewsletterPage};
