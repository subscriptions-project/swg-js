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

export const styleType = 'text/css';

/**
 * Add attributes to an element.
 */
function addAttributesToElement(
  element: Element,
  attributes: {[key: string]: string} = {}
) {
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }
}

/**
 * Create a new element on document with specified tagName and attributes.
 */
export function createElement(
  doc: Document,
  tagName: string,
  attributes: {[key: string]: string},
  content?: string
): Element {
  const element = doc.createElement(tagName);

  addAttributesToElement(element, attributes);

  if (content) {
    element.textContent = content;
  }

  return element;
}

/**
 * Removes the element.
 */
export function removeElement(element: Element) {
  if (element.parentElement) {
    element.parentElement.removeChild(element);
  }
}

/**
 * Removes all children from the parent element.
 */
export function removeChildren(parent: Element) {
  parent.textContent = '';
}

/**
 * Injects the provided styles in the HEAD section of the document.
 * @param doc The document object.
 * @param styleText The style string.
 */
export function injectStyleSheet(doc: Doc, styleText: string): Element {
  const styleElement = createElement(doc.getWin().document, 'style', {
    'type': styleType,
  });
  styleElement.textContent = styleText;
  doc.getHead().appendChild(styleElement);
  return styleElement;
}

/**
 * Whether the element have a next node in the document order.
 * This means either:
 *  a. The element itself has a nextSibling.
 *  b. Any of the element ancestors has a nextSibling.
 */
export function hasNextNodeInDocumentOrder(
  element: Element,
  stopNode: (Node | null) | undefined
): boolean {
  let currentElement: Element | ParentNode | null = element;
  do {
    if (currentElement.nextSibling) {
      return true;
    }
  } while (
    (currentElement = currentElement.parentNode) &&
    currentElement !== stopNode
  );
  return false;
}
