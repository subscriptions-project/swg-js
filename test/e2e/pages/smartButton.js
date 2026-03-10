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

class SmartButtonPage {
  constructor(page) {
    this.page = page;

    // The smartButton element wrapper
    this.smartButtonWrapper = page.locator('#smartButton').first();

    this.smartboxIframe = page.frameLocator('iframe[src*="smartboxiframe"]');
    this.smartButtonLabel = this.smartboxIframe
      .locator('.swg-button-light')
      .first();
    this.subscribeMessage = this.smartboxIframe.locator('.Z40VLd').first();
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      '/examples/sample-pub/1?smartbutton',
      experiments
    );
    await this.page.goto(url);
  }
}

module.exports = {SmartButtonPage};
