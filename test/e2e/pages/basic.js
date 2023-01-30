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

/**
 * @fileoverview Page object for the basic button.
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
      .assert.containsText('@contributionBtn', 'Contribute $0.99/week')
      .click('@contributionBtn');
  },
};

module.exports = {
  url: () => 'http://localhost:8000/demos/public/button-dark.html',
  commands: [commands],
  elements: {
    swgBasicButton: {
      selector: '.swg-button-v2-dark',
    },
    contributeBtn: {
      selector: '.PNojLb button',
    },
  },
};
