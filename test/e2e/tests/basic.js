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
  /*
  'Show button': (browser) => {
    const basic = browser.page.basic();
    basic
      .navigate()
      .waitForElementPresent('@swgBasicButton', 'Found button')
      .waitForElementVisible('@swgBasicButton')
      .click('@swgBasicButton')
      .pause(1000)
      .assert.screenshotIdenticalToBaseline('html', 'basic-contribution')
      .viewContributionOffers()
      .assert.textContains('@contributionHeader', 'Swgjs Contribution Demos')
      .assert.textContains('@priceChip', '$1')
      .contribute()
      .checkPayment()
      .end();
  },
*/
};
