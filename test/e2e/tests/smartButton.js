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
  '@tags': ['smart'],

  'Show Smart Button': function (browser) {
    const smartButton = browser.page.smartButton();
    smartButton
      .navigate()
      // button > iframe > button
      .assert.elementPresent('@smartButton')
      .switchToFrame('[src*="smartboxiframe"]', 'SwG Smart Button iFrame')
      .assert.elementPresent('@smartButtonLabel')
      .assert.attributeContains(
        '@smartButtonLabel',
        'aria-label',
        'Subscribe with Google'
      )
      .assert.visible(
        '.Z40VLd',
        'Subscribe to The Scenic in less than 2 minutes'
      )
      .end();
  },

  'Show offers after clicking smart button': function (browser) {
    const smartButton = browser.page.smartButton();
    smartButton
      .navigate()
      .switchToFrame('[src*="smartboxiframe"]', 'SwG Smart Button iFrame')
      .click('.swg-button-light', function (result) {
        this.assert.strictEqual(result.status, 0);
        this.log('Clicking smart button.');
      })
      .end();
  },
};
