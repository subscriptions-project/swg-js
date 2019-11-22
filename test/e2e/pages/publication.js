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
  viewFirstArticle: function() {
    this.api.pause(1000);
    return this.log('Visiting the first article')
      .click('@firstArticle')
      .assert.title('16 Top Spots for Hiking - The Scenic - USA');
  },
  viewOffers: function() {
    return this.log('Viewing offers')
      .switchToFrame('[src*="about:blank"]', 'SwG outer iFrame')
      .switchToFrame('[src*="offersiframe"]', 'SwG inner iFrame');
  },
  selectOffer: function() {
    return this.viewOffers()
      .log('Selecting "Basic Access" offer')
      .click('.qLPyoc')
      .pause(1000);
  },
};

module.exports = {
  url: 'https://scenic-2017.appspot.com',
  commands: [commands],
  elements: {
    firstArticle: {
      selector: "a[href='./1?']",
    },
    swgIFrame: {
      selector: 'iframe.swg-dialog',
    },
  },
};
