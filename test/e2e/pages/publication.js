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
 * @fileoverview Page object for the publication on scenic.
 */
const commands = {
  viewFirstArticle: function () {
    this.api.pause(1000);
    return this.log('Visiting the first article').assert.title(
      '16 Top Spots for Hiking - The Scenic'
    );
  },
  selectOffer: function () {
    return this.viewOffers()
      .log('Selecting "Basic Access" offer')
      .waitForElementPresent('.qLPyoc')
      .click('.qLPyoc')
      .pause(1000);
  },
};

module.exports = {
  url: function () {
    return this.api.launchUrl;
  },
  commands: [commands],
  elements: {
    swgIFrame: {
      selector: 'iframe.swg-dialog',
    },
  },
};
