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
export interface Doc {
  /**
   */
  getWin(): Window;

  /**
   * The `Document` node or analog.
   */
  getRootNode(): Node;

  /**
   * The `Document.documentElement` element or analog.
   */
  getRootElement(): Element;

  /**
   * The `Document.head` element or analog. Returns `null` if not available
   * yet.
   */
  getHead(): Element;

  /**
   * The `Document.body` element or analog. Returns `null` if not available
   * yet.
   */
  getBody(): Element | null;

  /**
   * Whether the document has been fully constructed.
   */
  isReady(): boolean;

  /**
   * Resolved when document has been fully constructed.
   */
  whenReady(): Promise<any>;
}

export class GlobalDoc implements Doc {
  private readonly doc_: Document;
  private readonly win_: Window;

  /**
   * @param {!Window|!Document} winOrDoc
   */
  constructor(winOrDoc: Window | Document) {
    const isWin = 'document' in winOrDoc;
    this.win_ = isWin ? winOrDoc : winOrDoc.defaultView!;
    this.doc_ = isWin ? winOrDoc.document : winOrDoc;
  }

  getWin() {
    return this.win_;
  }

  getRootNode() {
    return this.doc_;
  }

  getRootElement() {
    return this.doc_.documentElement;
  }

  getHead() {
    // `document.head` always has a chance to be parsed, at least partially.
    return /** @type {!Element} */ this.doc_.head;
  }

  getBody() {
    return this.doc_.body;
  }

  isReady() {
    return isDocumentReady(this.doc_);
  }

  whenReady() {
    return whenDocumentReady(this.doc_);
  }
}

export function resolveDoc(input: Document | Window | Doc): Doc {
  // Is it a `Document`?
  if ('nodeType' in input) {
    return new GlobalDoc(input);
  }

  // Is it a `Window`?
  if ('document' in input) {
    return new GlobalDoc(input);
  }

  return input;
}
