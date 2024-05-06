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
  '@tags': ['basic'],

  'Subscribe': (browser) => {
    const basic = browser.page.basicSubscription();
    basic
      .navigate()
      .waitForElementPresent('@swgBasicButton', 'Found button')
      .waitForElementVisible('@swgBasicButton')
      .click('@swgBasicButton')
      .pause(3000)
      .assert.screenshotIdenticalToBaseline('html', 'basic-subscription')
      .viewSubscriptionOffers()
      .assert.textContains('@subscriptionHeader', 'Swgjs Subscription Demos')
      .subscribe()
      .checkPayment()
      .end();
  },
};
