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
'use strict';

/**
 * @fileoverview Creates an http server to handle static
 * files and list directories for use with the live server for
 * deployment to GAE.
 */

const app = require(require.resolve('./server-app'));
const express = require('express');
const port = process.env.PORT || 8080;

// View cache.
app.enable('view cache');

// Enable static file serving via express.
app.use(express.static('.'));

// Start express webserver
console.log('Start server: ', port);
app.listen(port, () => {
  console.log('App listening on port: ', port);
  console.log('Press Ctrl+C to quit.');
});
