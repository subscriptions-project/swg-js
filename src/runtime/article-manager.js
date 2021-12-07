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

import {EntitlementsManager} from './entitlements-manager';

export class ArticleManager extends EntitlementsManager {
  /**
   * @param {!Window} win
   * @param {!../model/page-config.PageConfig} pageConfig
   * @param {!./fetcher.Fetcher} fetcher
   * @param {!./deps.DepsDef} deps
   */
  constructor(win, pageConfig, fetcher, deps) {
    super(win, pageConfig, fetcher, deps);

    /** @override */
    this.encodedParamName_ = 'encodedEntitlementsParams';

    /** @override */
    this.action_ = '/article';

    this.article_ = null;
  }

  /** @override @inheritdoc */
  getArticle() {
    if (this.responsePromise_) {
      return this.responsePromise_.then(Promise.resolve(this.article_));
    }
    return Promise.resolve(this.article_);
  }

  /** @override @inheritdoc */
  fetch_(params) {
    return super.fetch_(params).then((json) => {
      this.article_ = json;
      return json['entitlements'];
    });
  }
}
