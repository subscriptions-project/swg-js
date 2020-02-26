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

/** @const {boolean} */
const SUPPORTS_PASSIVE_LISTENERS = (() => {
  if (SUPPORTS_PASSIVE_LISTENERS !== null) {
    return SUPPORTS_PASSIVE_LISTENERS;
  }
  let supportsPassive = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get: function() {
        supportsPassive = true;
      },
    });
    /**
     * TODO(nbeloglazov): remove quoting once following TODO is done:
     * http://google3/javascript/externs/w3c_event.js?l=34&rcl=138424822
     */
    // OK to use goog.global because we're testing if browser supports
    // passive events and it is common to all windows.
    addEventListener('test', null, opts);
  } catch (e) {}
  return supportsPassive;
})();

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

/**
 * @param {!AddEventListenerOptions|undefined} options
 * @return {!AddEventListenerOptions|boolean}
 */
function getCaptureParamOrPassthroughOptions(options) {
  if (!options) {
    return false;
  }
  // If the browser supports passive listeners, it must accept an options
  // object, so return it as-is. Otherwise, return a boolean. Include a check
  // for options.passive so that JSCompiler can strip the passive support check
  // if the passive param is consistently absent or false.
  return options.passive && SUPPORTS_PASSIVE_LISTENERS
    ? options
    : options.capture || false;
}

/**
 * Removes a DOM event listener from a target.
 * @param {!Window|!Document|!Element} target The event source.
 * @param {string} eventName The name of the
 *     event.
 * @param {function(?)} handler The handler function to be removed.
 * @param {!EventListenerOptions=} opt_options Whether the
 *     event was registered for capture phase.
 * @return {boolean} True if event handler was unregistered successfully.
 */
export function unregisterEventHandler(
  target,
  eventName,
  handler,
  opt_options
) {
  if (target.removeEventListener) {
    const opts = getCaptureParamOrPassthroughOptions(opt_options);
    target.removeEventListener(eventName, handler, opts);
    return true;
  }
  return false;
}

/**
 * Adds a DOM event listener to a target.
 * @param {!Window|!Document|!Element} target The event source.
 * @param {string} eventName The name of the
 *     event.
 * @param {function(?)} handler The event handler function.
 * @param {!AddEventListenerOptions=} opt_options Use the
 *     capture phase if supported. Use OPTIONS_CAPTURE and OPTIONS_PASSIVE for
 *     common options.
 * @return {boolean} True if event handler was registered successfully.
 */
export function registerEventHandler(target, eventName, handler, opt_options) {
  if (target.addEventListener) {
    const opts = getCaptureParamOrPassthroughOptions(opt_options);
    target.addEventListener(eventName, handler, opts);
    return true;
  }
  return false;
}

/**
 * Checks whether an iframe exists in a window.
 * @param {!Window} win The window to check, which could be a xdomain window.
 * @param {string} frameName The frameName to lookup.
 * @return {boolean} Whether or not iframe exist in the window.
 */
function doesIframeExistInWindow(win, frameName) {
  // Win.frames[frameName] returns a reference to the child iframe with
  // name frameName (even if caller is coming from a cross-domain window).
  // Must be wrapped in a try catch as some browsers throw an exception if
  // you access crossDomainWindow.frames['not_an_iframe_name'].
  // This feature is not officially documented, but it existed since
  // Netscape Navigator age and everyone depends on it.
  try {
    return !!(win.frames && win.frames[frameName]);
  } catch (e) {
    return false;
  }
}

/**
 * Gets the parent window of the given window, if one exists.
 * @param {!Window} win The window to find the parent of.
 * @return {?Window} The parent window, or null if no parent exists.
 */
function getParentWindow(win) {
  try {
    const parentWin = win.parent;
    // When win == win.parent, win is the top window and there are no further
    // ancestors.
    if (parentWin && parentWin != win) {
      return parentWin;
    }
  } catch (err) {
    // Based on error logs, some versions of Firefox may throw a permission
    // exception when trying to access the parent window, when code is running
    // inside of an extension.
  }
  return null;
}

/**
 * Search the window or its ancestor windows for the iframe frameName.
 * @param {!Window} win The window start searching.
 * @param {string} frameName The frameName to lookup
 * @param {number} maxSteps The maxium steps we will search.
 * @return {?Window} The window that has iframe frameName.
 */
export function searchIframeInWindowOrAncestors(win, frameName, maxSteps) {
  let curWin = win;
  for (let i = 0; i < maxSteps; ++i) {
    if (doesIframeExistInWindow(curWin, frameName)) {
      return curWin;
    }
    if (!(curWin = getParentWindow(curWin))) {
      // No parent window.
      return null;
    }
  }
  return null;
}

/**
 * Wraps a function to allow it to be called, at most, once. All
 * additional calls are no-ops.
 *
 * This is particularly useful for initialization functions
 * that should be called, at most, once.
 *
 * @param {function():*} f Function to call.
 * @return {function():undefined} Wrapped function.
 */
export function runOnce(f) {
  // Keep a reference to the function that we null out when we're done with
  // it -- that way, the function can be GC'd when we're done with it.
  let inner = f;
  return function() {
    if (inner) {
      const tmp = inner;
      inner = null;
      tmp();
    }
  };
}
