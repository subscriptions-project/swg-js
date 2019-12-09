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
  'Show offers Automatically for a logged in user': function(browser) {
    const setup = browser.page.setup();
    setup.navigate().select('local');

    const login = browser.page.login();
    login.navigate().login();

    const publication = browser.page.publication();
    publication
      .navigate()
      .viewFirstArticle()
      .waitForElementPresent('@swgIFrame', 'Found SwG iFrame')
      .viewOffers()
      .waitForElementPresent('.K2Fgzb', 'Found Subscribe button')
      .assert.containsText('.K2Fgzb', 'Subscribe with your Google Account')
      .assert.containsText('.wlhaj.I3RyHc', 'Already subscribed?')
      .assert.containsText('.amekj', 'Basic access')
      .assert.containsText('.mojnzf', '$0.99/week')
      .assert.containsText('.a02uaf', 'Unlimited access, anywhere anytime')
      .assert.containsText('.HJ9fUd', 'Free one month trial')
      .assert.containsText('.ZIHl3c', 'Price for the first week')
      .end();
  },
  'User log in, select an offer and see gpay window': function(browser) {
    const login = browser.page.login();
    login.navigate().login();

    const publication = browser.page.publication();
    publication
      .navigate()
      .viewFirstArticle()
      .selectOffer();

    browser.checkPayment().end();
  },
};
