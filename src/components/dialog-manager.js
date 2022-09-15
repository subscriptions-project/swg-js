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

import {Dialog} from './dialog';
import {Graypane} from './graypane';
import {isCancelError} from '../utils/errors';

const POPUP_Z_INDEX = 2147483647;

/**
 * The class for the top level dialog.
 * @final
 */
export class DialogManager {
  /**
   * @param {!../model/doc.Doc} doc
   */
  constructor(doc) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;

    /** @private {?Dialog} */
    this.dialog_ = null;

    /** @private {?Promise<!Dialog>} */
    this.openPromise_ = null;

    /** @private @const {!Graypane} */
    this.popupGraypane_ = new Graypane(doc, POPUP_Z_INDEX);

    /** @private {?Window} */
    this.popupWin_ = null;

    this.popupGraypane_.getElement().addEventListener('click', () => {
      if (this.popupWin_) {
        try {
          this.popupWin_.focus();
        } catch (e) {
          // Ignore error.
        }
      }
    });
  }

  /**
   * @param {boolean=} hidden
   * @param {!./dialog.DialogConfig=} dialogConfig Configuration options for the
   *     dialog.
   * @return {!Promise<!Dialog>}
   */
  openDialog(hidden = false, dialogConfig = {}) {
    if (!this.openPromise_) {
      this.dialog_ = new Dialog(
        this.doc_,
        /* importantStyles */ {},
        /* styles */ {},
        dialogConfig
      );
      this.openPromise_ = this.dialog_.open(hidden);
    }
    return this.openPromise_;
  }

  /**
   * @param {!./view.View} view
   * @param {boolean=} hidden
   * @param {!./dialog.DialogConfig=} dialogConfig Configuration options for the
   *    dialog.
   * @return {!Promise}
   */
  openView(view, hidden = false, dialogConfig = {}, enableErrorView = false) {
    this.handleCancellations(view);
    if (enableErrorView) {
      this.handleGenericErrors_(view);
    }
    return this.openDialog(hidden, dialogConfig).then((dialog) => {
      return dialog.openView(view);
    });
  }

  /**
   * Opens ErrorView and resets port promise in the view in preparation of re-connection.
   * @param {!./view.View} view
   * @private
   */
  openErrorView_(view) {
    if (this.dialog_) {
      this.dialog_.openErrorView();
      // The failed port promise should be reset before appending promise chains (e.g., cancellation handler).
      view.resetPortPromise();
      this.handleCancellations(view);
      this.handleGenericErrors_(view);
    }
  }

  /**
   * Handles cancellations (ex: user clicks close button on dialog).
   * @param {!./view.View} view
   * @return {!Promise}
   */
  handleCancellations(view) {
    return view.whenComplete().catch((reason) => {
      if (isCancelError(reason)) {
        this.completeView(view);
      }
      throw reason;
    });
  }

  /**
   * Enables ErrorView on generic errors other than cancellations.
   * @param {!./view.View} view
   * @return {!Promise}
   */
  handleGenericErrors_(view) {
    return view.whenComplete().catch((reason) => {
      if (!isCancelError(reason)) {
        this.openErrorView_(view);
      } else {
        throw reason;
      }
    });
  }

  /**
   * @param {?./view.View} view
   */
  completeView(view) {
    // Give a small amount of time for another view to take over the dialog.
    setTimeout(() => {
      if (this.dialog_ && this.dialog_.getCurrentView() == view) {
        this.close_();
      }
    }, 100);
  }

  /**
   */
  completeAll() {
    if (this.dialog_) {
      this.close_();
    }
    if (this.popupGraypane_.isAttached()) {
      this.popupGraypane_.destroy();
    }
  }

  /**
   * @returns {?Dialog}
   */
  getDialog() {
    return this.dialog_;
  }

  /** @private */
  close_() {
    this.dialog_.close();
    this.dialog_ = null;
    this.openPromise_ = null;
  }

  /**
   * @param {?Window|undefined} targetWin
   */
  popupOpened(targetWin) {
    this.popupWin_ = targetWin || null;
    if (!this.popupGraypane_.isAttached()) {
      this.popupGraypane_.attach();
    }
    this.popupGraypane_.show();
  }

  /**
   */
  popupClosed() {
    this.popupWin_ = null;
    try {
      this.popupGraypane_.hide();
    } catch (e) {
      // Ignore.
    }
  }
}
