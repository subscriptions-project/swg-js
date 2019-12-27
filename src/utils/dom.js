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

import {assert} from './log';
import {setStyles} from './style';

/** @const @enum{string} */
export const styleLinkAttrs = {
  'rel': 'stylesheet',
  'type': 'text/css',
};

/** @const {string} */
export const styleType = 'text/css';

/** @const {string} */
export const styleExistsQuerySelector = 'link[rel=stylesheet][href]';

/**
 * Add attributes to an element.
 * @param {!Element} element
 * @param {!Object<string, string|number|boolean|!Object<string, string|number|boolean>>} attributes
 * @return {!Element} updated element.
 */
export function addAttributesToElement(element, attributes) {
  for (const attr in attributes) {
    if (attr == 'style') {
      setStyles(
        element,
        /** @type {!Object<string, string|boolean|number>} */
        (attributes[attr])
      );
    } else {
      element.setAttribute(
        attr,
        /** @type {string|boolean|number} */ (attributes[attr])
      );
    }
  }
  return element;
}

/**
 * Create a new element on document with specified tagName and attributes.
 * @param {!Document} doc
 * @param {string} tagName
 * @param {!Object<string, string>} attributes
 * @param {?(string|!Node|!ArrayLike<!Node>|!Array<!Node>)=} content
 * @return {!Element} created element.
 */
export function createElement(doc, tagName, attributes, content) {
  const element = doc.createElement(tagName);
  addAttributesToElement(element, attributes);
  if (content != null) {
    if (typeof content == 'string') {
      element.textContent = content;
    } else if (content.nodeType) {
      element.appendChild(content);
    } else if ('length' in content) {
      for (let i = 0; i < content.length; i++) {
        element.appendChild(content[i]);
      }
    } else {
      assert(false, 'Unsupported content: %s', content);
    }
  }
  return element;
}

/**
 * Removes the element.
 * @param {!Element} element
 */
export function removeElement(element) {
  if (element.parentElement) {
    element.parentElement.removeChild(element);
  }
}

/**
 * Removes all children from the parent element.
 * @param {!Element} parent
 */
export function removeChildren(parent) {
  parent.textContent = '';
}

/**
 * Injects the provided styles in the HEAD section of the document.
 * @param {!../model/doc.Doc} doc The document object.
 * @param {string} styleText The style string.
 * @return {!Element}
 */
export function injectStyleSheet(doc, styleText) {
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
 * @param {!Element} element
 * @param {?Node=} stopNode
 * @return {boolean}
 */
export function hasNextNodeInDocumentOrder(element, stopNode) {
  let currentElement = element;
  do {
    if (currentElement.nextSibling) {
      return true;
    }
  } while (
    (currentElement = currentElement.parentNode) &&
    currentElement != stopNode
  );
  return false;
}

/**
 * Polyfill of the `Node.isConnected` API. See
 * https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected.
 * @param {!Node} node
 * @return {boolean}
 */
export function isConnected(node) {
  // Ensure that node is attached if specified. This check uses a new and
  // fast `isConnected` API and thus only checked on platforms that have it.
  // See https://www.chromestatus.com/feature/5676110549352448.
  if ('isConnected' in node) {
    return node['isConnected'];
  }
  // Polyfill.
  const root = node.ownerDocument && node.ownerDocument.documentElement;
  return (root && root.contains(node)) || false;
}

/**
 * Returns true if current browser is a legacy version of Edge.
 *
 * Starting in January 2020, new versions of Edge will use the Chromium engine.
 * These versions won't include the word "Edge" in their useragent.
 * Instead, they'll include the word "Edg".
 * So far, it seems safe to avoid detecting these new versions of Edge.
 * @param {!Window} win
 * @return {boolean}
 */
export function isLegacyEdgeBrowser(win) {
  const nav = win.navigator;
  return /Edge/i.test(nav && nav.userAgent);
}
