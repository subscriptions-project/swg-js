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

import {Doc} from '../model/doc';
import {setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

export class Graypane {
  private doc_: Doc;
  private fadeBackground_: HTMLElement;

  constructor(doc: Doc, zIndex: number) {
    this.doc_ = doc;

    this.fadeBackground_ = this.doc_
      .getWin()
      .document.createElement('swg-popup-background');

    this.fadeBackground_.setAttribute('role', 'button');

    setImportantStyles(this.fadeBackground_, {
      'z-index': zIndex.toString(),
      'display': 'none',
      'position': 'fixed',
      'top': '0',
      'right': '0',
      'bottom': '0',
      'left': '0',
      'background-color': 'rgba(32, 33, 36, .6)',
    });
  }

  getElement(): Element {
    return this.fadeBackground_;
  }

  isAttached(): boolean {
    return !!this.fadeBackground_.parentNode;
  }

  /**
   * Attaches the graypane to the document.
   */
  attach(): void {
    this.doc_.getBody()?.appendChild(this.fadeBackground_);
  }

  /**
   * Detaches the graypane to the document.
   */
  destroy(): void {
    this.doc_.getBody()?.removeChild(this.fadeBackground_);
  }

  /**
   * Shows the graypane.
   */
  show(animated: boolean): Promise<void> | void {
    setImportantStyles(this.fadeBackground_, {
      'display': 'block',
      'opacity': animated ? '0' : '1',
    });

    if (animated) {
      return transition(
        this.fadeBackground_,
        {
          'opacity': '1',
        },
        300,
        'ease-out'
      );
    }
  }

  /**
   * Hides the graypane.
   */
  async hide(animated = true): Promise<void> {
    if (animated) {
      await transition(
        this.fadeBackground_,
        {
          'opacity': '0',
        },
        300,
        'ease-out'
      );
    }

    setImportantStyles(this.fadeBackground_, {'display': 'none'});
  }
}
