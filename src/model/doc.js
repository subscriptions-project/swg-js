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

import {isDocumentReady, whenDocumentReady} from '../utils/document-ready';

/**
 * @interface
 */
export class Doc {
  /**
   * @return {!Window}
   */
  getWin() {}

  /**
   * The `Document` node or analog.
   * @return {!Node}
   */
  getRootNode() {}

  /**
   * The `Document.documentElement` element or analog.
   * @return {!Element}
   */
  getRootElement() {}

  /**
   * The `Document.head` element or analog. Returns `null` if not available
   * yet.
   * @return {!Element}
   */
  getHead() {}

  /**
   * The `Document.body` element or analog. Returns `null` if not available
   * yet.
   * @return {?Element}
   */
  getBody() {}

  /**
   * Whether the document has been fully constructed.
   * @return {boolean}
   */
  isReady() {}

  /**
   * Resolved when document has been fully constructed.
   * @return {!Promise}
   */
  whenReady() {}

  /**
   * Adds the element to the fixed layer.
   * @param {!Element} unusedElement
   * @return {!Promise}
   *
   * This is a no-op for except in AMP on iOS < 13.0.
   */
  addToFixedLayer(unusedElement) {}
}

/** @implements {Doc} */
export class GlobalDoc {
  /**
   * @param {!Window|!Document} winOrDoc
   */
  constructor(winOrDoc) {
    const isWin = !!winOrDoc.document;
    /** @private @const {!Window} */
    this.win_ = /** @type {!Window} */ (isWin
      ? /** @type {!Window} */ (winOrDoc)
      : /** @type {!Document} */ (winOrDoc).defaultView);
    /** @private @const {!Document} */
    this.doc_ = isWin
      ? /** @type {!Window} */ (winOrDoc).document
      : /** @type {!Document} */ (winOrDoc);
  }

  /** @override */
  getWin() {
    return this.win_;
  }

  /** @override */
  getRootNode() {
    return this.doc_;
  }

  /** @override */
  getRootElement() {
    return this.doc_.documentElement;
  }

  /** @override */
  getHead() {
    // `document.head` always has a chance to be parsed, at least partially.
    return /** @type {!Element} */ (this.doc_.head);
  }

  /** @override */
  getBody() {
    return this.doc_.body;
  }

  /** @override */
  isReady() {
    return isDocumentReady(this.doc_);
  }

  /** @override */
  whenReady() {
    return whenDocumentReady(this.doc_);
  }

  /** @override */
  addToFixedLayer(unusedElement) {
    return Promise.resolve();
  }
}

/**
 * @param {!Document|!Window|!Doc} input
 * @return {!Doc}
 */
export function resolveDoc(input) {
  // Is it a `Document`
  if (/** @type {!Document} */ (input).nodeType === /* DOCUMENT */ 9) {
    return new GlobalDoc(/** @type {!Document} */ (input));
  }
  // Is it a `Window`?
  if (/** @type {!Window} */ (input).document) {
    return new GlobalDoc(/** @type {!Window} */ (input));
  }
  return /** @type {!Doc} */ (input);
}
