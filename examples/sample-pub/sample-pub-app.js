/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

const app = module.exports = require('express').Router();

const ARTICLES = (function() {
  const list = [];
  for (let i = 0; i < 10; i++) {
    list.push({id: i, title: 'Article ' + (i + 1)});
  }
  return list;
})();


/**
 * List all Articles.
 */
app.get('/', (req, res) => {
  res.render('../examples/sample-pub/views/list', {
    title: 'Select an article to get started',
    articles: ARTICLES,
  });
});


/**
 * An Article.
 */
app.get('/((\\d+))', (req, res) => {
  const id = parseInt(req.params[0]);
  const prevId = (id - 1) >= 0 ? String(id - 1) : false;
  const nextId = (id + 1) < ARTICLES.length ? String(id + 1) : false;
  res.render('../examples/sample-pub/views/article', {
    title: 'Article ' + id,
    prev: prevId,
    next: nextId,
  });
});
