/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {Dialog} from './dialog';


/**
 * The class for the top level dialog.
 * @final
 */
export class DialogManager {

  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private {?Dialog} */
    this.dialog_ = null;

    /** @private {?Promise<!Dialog>} */
    this.openPromise_ = null;
  }

  /**
   * @return {!Promise<!Dialog>}
   */
  openDialog() {
    if (!this.openPromise_) {
      this.dialog_ = new Dialog(this.win_);
      this.openPromise_ = this.dialog_.open();
    }
    return this.openPromise_;
  }

  /**
   * @param {!./view.View} view
   * @return {!Promise}
   */
  openView(view) {
    return this.openDialog().then(dialog => {
      return dialog.openView(view);
    });
  }

  /**
   * @param {!./view.View} view
   */
  completeView(view) {
    // Give a small amount of time for another view to take over the dialog.
    setTimeout(() => {
      if (this.dialog_ && this.dialog_.getCurrentView() == view) {
        this.dialog_.close();
        this.dialog_ = null;
        this.openPromise_ = null;
      }
    }, 100);
  }
}
