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

const cheerio = require('cheerio');
const fs = require('fs').promises;

async function main() {
  const files = await fs.readdir(__dirname);
  const xlbFiles = files.filter((name) => /\.xlb$/.test(name));
  const localesPerMessage = {};
  for (const xlbFile of xlbFiles) {
    const xml = await fs.readFile(__dirname + '/' + xlbFile, 'utf8');
    const $ = cheerio.load(xml);
    let locale = $('localizationbundle').attr('locale').toLocaleLowerCase();
    if (locale.startsWith('en-')) {
      locale = 'en';
    }
    for (let $msg of $('msg').toArray()) {
      $msg = cheerio($msg);
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
//   This document describes how to change i18n strings in swg-js: https://docs.google.com/document/d/1FMEKJ_TmjHhqON0krE4xhDbTEj0I0DnvzxMzB2cWUWA/edit?resourcekey=0-TQ7hPOzAD4hX8x9PfweGSg#heading=h.q9gi7t4h1tyj

export const I18N_STRINGS = ${JSON.stringify(localesPerMessage, null, 2)};
`;
  fs.writeFile(__dirname + '/../../../src/i18n/strings.js', js);
}

main();
