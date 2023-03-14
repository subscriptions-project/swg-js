/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

/** @fileoverview Compiles XLB files into a single JSON file with translations. */

// Note: This guide describes how to change i18n strings in Swgjs: go/swg-showcase-i18n

const cheerio = require('cheerio');
const fs = require('fs').promises;

async function buildI18nStrings() {
  const xlbDir = __dirname + '/../../assets/i18n/strings';
  const files = await fs.readdir(xlbDir);
  const xlbFiles = files.filter((name) => /\.xlb$/.test(name));
  const localesPerMessage = {};
  for (const xlbFile of xlbFiles) {
    const xml = await fs.readFile(xlbDir + '/' + xlbFile, 'utf8');
    const $ = cheerio.load(xml);
    let locale = $('localizationbundle').attr('locale').toLocaleLowerCase();
    if (locale.startsWith('en-')) {
      locale = 'en';
    }
    for (let $msg of $('msg').toArray()) {
      $msg = $($msg);
      const name = $msg.attr('name');
      if (!localesPerMessage[name]) {
        localesPerMessage[name] = {};
      }
      localesPerMessage[name][locale] = $msg.html();
    }
  }
  const js = `
/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

// NOTE: Please don't edit this file directly!
//   This guide describes how to change i18n strings in Swgjs: go/swg-showcase-i18n

export const I18N_STRINGS = ${JSON.stringify(localesPerMessage, null, 2)};
`;
  fs.writeFile(__dirname + '/../../src/i18n/strings.ts', js);
}

buildI18nStrings();
