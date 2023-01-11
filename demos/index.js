/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

// NOTE: This app isn't used, yet.
// Eventually though, it could replace the Scenic servers.
// To test Swgjs locally, just run `swgjs_start_server`.
// That will start up a different Express app that lets
// you test your local JavaScript and CSS changes.

const express = require('express');
const app = express();
const port = process.env.PORT || 8000;

app.use(express.static('public'));

/**
 * Redirects to SwG JS binary (swg.js or swg-basic.js).
 * The endpoint is compatible with the classic Swgjs local demos.
 */
app.get('/examples/sample-pub/redirect-to/:jsfile', (req, res) => {
  const jsfile = req.params.jsfile;
  const jsurl =
    'https://news.google.com/swg/js/v1/' + req.get('referrer')?.match('/qual/')
      ? `${jsfile.split('.')[0]}-qual.js`
      : jsfile;
  res.redirect(jsurl);
});

app.listen(port, () => {
  console /*OK*/
    .log(`SwG Basic demos are available at http://localhost:${port}`);
});
