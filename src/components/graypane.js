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

import {setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

export class Graypane {
  /**
   * @param {!../model/doc.Doc} doc
   * @param {number} zIndex
   */
  constructor(doc, zIndex) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;

    /** @private @const {!Element} */
    this.fadeBackground_ = this.doc_
      .getWin()
      .document.createElement('swg-popup-background');
    setImportantStyles(this.fadeBackground_, {
      'z-index': zIndex,
      'display': 'none',
      'pointer-events': 'none',
      'position': 'fixed',
      'top': 0,
      'right': 0,
      'bottom': 0,
      'left': 0,
      'background-color': 'rgba(32, 33, 36, .6)',
    });
  }

  /**
   * @return {!Element}
   */
  getElement() {
    return this.fadeBackground_;
  }

  /**
   * @return {boolean}
   */
  isAttached() {
    return !!this.fadeBackground_.parentNode;
  }

  /**
   * Attaches the graypane to the document.
   */
  attach() {
    this.doc_.getBody().appendChild(this.fadeBackground_);
  }

  /**
   * Detaches the graypane to the document.
   */
  destroy() {
    this.doc_.getBody().removeChild(this.fadeBackground_);
  }

  /**
   * Shows the graypane.
   * @param {boolean=} animated
   * @return {!Promise|undefined}
   */
  show(animated = true) {
    setImportantStyles(this.fadeBackground_, {
      'display': 'block',
      'opacity': animated ? 0 : 1,
    });
    if (animated) {
      return transition(
        this.fadeBackground_,
        {
          'opacity': 1,
        },
        300,
        'ease-out'
      );
    }
  }

  /**
   * Hides the graypane.
   * @param {boolean=} animated
   * @return {!Promise|undefined}
   */
  hide(animated = true) {
    if (animated) {
      return transition(
        this.fadeBackground_,
        {
          'opacity': 0,
        },
        300,
        'ease-out'
      ).then(() => {
        setImportantStyles(this.fadeBackground_, {'display': 'none'});
      });
    }
    setImportantStyles(this.fadeBackground_, {'display': 'none'});
  }
}
