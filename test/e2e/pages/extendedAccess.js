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

class ExtendedAccessPage {
  constructor(page) {
    this.page = page;
    this.swgRegwallDialog = page.locator('#swg-regwall-dialog').first();
    this.title = page.locator('.gaa-metering-regwall--title').first();
    this.description = page
      .locator('.gaa-metering-regwall--description')
      .first();
  }

  async navigate() {
    const experiments = process.env.SWG_EXPERIMENTS
      ? process.env.SWG_EXPERIMENTS.split(',')
      : [];
    const url = swgPageUrl(
      'http://localhost:8000',
      '/examples/sample-pub/1?metering',
      experiments
    );
    await this.page.goto(url);
  }
}

module.exports = {ExtendedAccessPage};
