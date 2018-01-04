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

import {Dialog} from '../components/dialog';
import {LoadingView} from '../ui/loading-view';


/**
 * The class for Offers flow.
 *
 */
export class OffersFlow {

  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!HTMLDocument} */
    this.document_ = win.document;

    /** @private @const {!Dialog} */
    this.dialog_ = new Dialog(this.document_);

    /** @private {?LoadingView} */
    this.loadingView_ = null;
  }

  /**
   * Starts the offers flow.
   * @return {!Promise}
   */
  start() {

    // Build the loading indicator.
    this.loadingView_ = new LoadingView(this.document_);

    return this.dialog_.open().then(() => {
      this.loadingView_.show();
      // TODO add Offers iframe.
    });
  }
}
