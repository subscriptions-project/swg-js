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

/**
 * @fileoverview Page object for the basic contribution page.
 */
const commands = {
  viewContributionOffers: function () {
    return this.pause(1000)
      .log('Viewing contribution offers')
      .switchToFrame('[src*="about:blank"]', 'SwG outer iFrame')
      .switchToFrame('[src*="contributionoffersiframe"]', 'SwG inner iFrame');
  },
  contribute: function () {
    return this.log('Clicking contribute button')
      .assert.textContains('@contributeBtn', 'Contribute $1 / month')
      .click('@contributeBtn');
  },
};

module.exports = {
  url: function () {
    return swgPageUrl(
      this.api.launchUrl,
      '/demos/public/button-dark.html',
      this.api.globals.swg_experiments
    );
  },
  commands: [commands],
  elements: {
    swgBasicButton: {
      selector: '.swg-button-v2-dark',
    },
    contributeBtn: {
      selector: '.PNojLb button',
    },
    contributionHeader: {
      selector: '.jNru1c',
    },
    priceChip: {
      selector: '.h57Fgb',
    },
  },
};
