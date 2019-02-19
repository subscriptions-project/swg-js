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
/**
 * @implements {PropensityApi}
 */
export class Propensity {

  constructor(win, pageConfig, fetcher) {
    /** @private @const {!../model/page-config.PageConfig} */
    this.pageConfig_ = pageConfig;
    /** @private @const {!./fetcher.Fetcher} */
    this.fetcher_ = fetcher;
    /** @private @const {!Window} */
    this.win_ = win;
    /** @private {?string} */
    this.state_ = null;
  }

  /** @override */
  initSession(state) {
    this.state_ = state;
    // TODO(sohanirao): inform server of subscription state
  }

  /** @override */
  getPropensity(type) {
    const propensityToSubscribe = undefined;
    // TODO(sohanirao): request propensity from server
    return Promise.resolve(propensityToSubscribe);
  }

  /** @override */
  event(userEvent, jsonParams) {
    // TODO(sohanirao): send event and params if necessary
    // TODO(sohanirao): determine if event updates subscription
    //                  state and inform server of new state
  }
}
