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

module.exports = {
  '@tags': ['buyflow'],
  'Show offers on web': function (browser) {
    const publication = browser.page.publication();
    publication
      .navigate()
      .viewFirstArticle()
      .waitForElementPresent('@swgIFrame', 'Found SwG iFrame')
      .viewOffers()
      .waitForElementPresent('.K2Fgzb', 'Found offer carousel')
      .assert.containsText('.K2Fgzb', 'Subscribe with your Google Account')
      .assert.containsText('.wlhaj.I3RyHc', 'Already subscribed?')
      .assert.containsText('.amekj', 'Weekly')
      .assert.containsText('.e02Wob', '$4.99/week')
      .end();
  },
  'Selecting an offer triggers Google Sign-In prompt': function (browser) {
    const publication = browser.page.publication();
    publication.navigate().viewFirstArticle().selectOffer();

    browser.checkPayment().end();
  },
  'Show offers on AMP': function (browser) {
    const amp = browser.page.amp();
    amp
      .navigate()
      .waitForElementPresent('@swgDialog', 'Found SwG dialog')
      .end();
  },
};
