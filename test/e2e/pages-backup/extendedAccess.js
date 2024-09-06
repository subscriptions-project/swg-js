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
 * @fileoverview Page object for the extended access feature on scenic.
 */

module.exports = {
  url: function () {
    return swgPageUrl(
      this.api.launchUrl,
      '/examples/sample-pub/1?metering',
      this.api.globals.swg_experiments
    );
  },
  elements: {
    swgRegwallDialog: {
      selector: '#swg-regwall-dialog',
    },
    title: {
      selector: '.gaa-metering-regwall--title',
    },
    description: {
      selector: '.gaa-metering-regwall--description',
    },
  },
};
