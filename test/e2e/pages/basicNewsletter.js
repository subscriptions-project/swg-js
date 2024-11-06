/**
 * @fileoverview Description of this file.
 */
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
 * @fileoverview Page object for the first article with contribution on scenic.
 */
const commands = {
  viewNewsletter: function () {
    return this.pause(1000)
      .log('Viewing newsletter')
      .switchToFrame('[src*="about:blank"]', 'SwG outer iFrame')
      .switchToFrame('[src*="newsletteriframe"]', 'SwG inner iFrame');
  },
  consentToNewsletter: function () {
    return this.log('Checking consent checkbox').click('@consentCheckbox');
  },
  optInAction: function () {
    return this.log('Clicking opt in button').click('@optInButton');
  },
};

module.exports = {
  url: function () {
    return swgPageUrl(
      this.api.launchUrl,
      '/demos/public/newsletter.html',
      this.api.globals.swg_experiments
    );
  },
  commands: [commands],
  elements: {
    consentCheckbox: {
      selector: '.MlG5Jc input',
    },
    consentMessage: {
      selector: '.MlG5Jc label',
    },
    newsletterHeader: {
      selector: '.sJIgh',
    },
    optInButton: {
      selector: '.C2qNIf button',
    },
    swgDialog: {
      selector: '.swg-dialog',
    },
  },
};
