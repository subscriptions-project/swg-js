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

import {Dialog, DialogConfig} from './dialog';
import {Doc} from '../model/doc';
import {Graypane} from './graypane';
import {View} from './view';
import {isCancelError} from '../utils/errors';

const POPUP_Z_INDEX = 2147483647;

/**
 * The class for the top level dialog.
 */
export class DialogManager {
  private enableBackgroundClickExperiment_ = false;
  private readonly doc_: Doc;
  private dialog_: Dialog | null;
  private openPromise_: Promise<Dialog> | null;
  private readonly popupGraypane_: Graypane;
  private popupWin_: Window | null;

  constructor(doc: Doc) {
    this.doc_ = doc;

    this.dialog_ = null;

    this.openPromise_ = null;

    this.popupGraypane_ = new Graypane(doc, POPUP_Z_INDEX);

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

  setEnableBackgroundClickExperiment(value: boolean) {
    this.enableBackgroundClickExperiment_ = value;
  }

  openDialog(hidden = false, dialogConfig: DialogConfig = {}): Promise<Dialog> {
    if (!this.openPromise_) {
      this.dialog_ = new Dialog(
        this.doc_,
        /* importantStyles */ {},
        /* styles */ {},
        dialogConfig,
        this.enableBackgroundClickExperiment_
      );
      this.openPromise_ = this.dialog_.open(hidden);
    }
    return this.openPromise_;
  }

  async openView(
    view: View,
    hidden = false,
    dialogConfig: DialogConfig = {}
  ): Promise<void> {
    this.handleCancellations(view);
    const dialog = await this.openDialog(hidden, dialogConfig);
    return dialog.openView(view);
  }

  /**
   * Handles cancellations (ex: user clicks close button on dialog).
   */
  async handleCancellations(view: View): Promise<void> {
    try {
      await view.whenComplete();
    } catch (reason) {
      if (isCancelError(reason as Error)) {
        this.completeView(view);
      }
      throw reason;
    }
  }

  completeView(view: View | null) {
    // Give a small amount of time for another view to take over the dialog.
    setTimeout(() => {
      if (this.dialog_ && this.dialog_.getCurrentView() === view) {
        this.close_();
      }
    }, 100);
  }

  completeAll() {
    if (this.dialog_) {
      this.close_();
    }
    if (this.popupGraypane_.isAttached()) {
      this.popupGraypane_.destroy();
    }
  }

  getDialog(): Dialog | null {
    return this.dialog_;
  }

  private close_() {
    this.dialog_?.close();
    this.dialog_ = null;
    this.openPromise_ = null;
  }

  popupOpened(targetWin?: Window | null) {
    this.popupWin_ = targetWin || null;
    if (!this.popupGraypane_.isAttached()) {
      this.popupGraypane_.attach();
    }
    this.popupGraypane_.show(/* animated */ true);
  }

  popupClosed() {
    this.popupWin_ = null;
    try {
      this.popupGraypane_.hide();
    } catch (e) {
      // Ignore.
    }
  }
}
