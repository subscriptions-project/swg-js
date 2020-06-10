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

/**
 * @param {!Document} doc
 * @return {string}
 */
function getReadyState(doc) {
  return /** @type {string} */ (doc['readyState']);
}

/**
 * Whether the document is ready.
 * @param {!Document} doc
 * @return {boolean}
 */
export function isDocumentReady(doc) {
  const readyState = getReadyState(doc);
  return readyState != 'loading' && readyState != 'uninitialized';
}

/**
 * Whether the document has loaded all the css and sub-resources.
 * @param {!Document} doc
 * @return {boolean}
 */
function isDocumentComplete(doc) {
  return getReadyState(doc) == 'complete';
}

/**
 * Calls the callback when document is ready.
 * @param {!Document} doc
 * @param {function(!Document)} callback
 */
export function onDocumentReady(doc, callback) {
  onDocumentState(doc, isDocumentReady, callback);
}

/**
 * Calls the callback once when document's state satisfies the condition.
 * @param {!Document} doc
 * @param {function(!Document):boolean} condition
 * @param {function(!Document)} callback
 */
function onDocumentState(doc, condition, callback) {
  if (condition(doc)) {
    // Execute callback right now.
    callback(doc);
    return;
  }

  // Execute callback (once!) after condition is satisfied.
  let callbackHasExecuted = false;
  const readyListener = () => {
    if (condition(doc) && !callbackHasExecuted) {
      callback(doc);
      callbackHasExecuted = true;
      doc.removeEventListener('readystatechange', readyListener);
    }
  };
  doc.addEventListener('readystatechange', readyListener);
}

/**
 * Returns a promise that is resolved when document is ready.
 * @param {!Document} doc
 * @return {!Promise<!Document>}
 */
export function whenDocumentReady(doc) {
  return new Promise((resolve) => {
    onDocumentReady(doc, resolve);
  });
}

/**
 * Returns a promise that is resolved when document is complete.
 * @param {!Document} doc
 * @return {!Promise<!Document>}
 */
export function whenDocumentComplete(doc) {
  return new Promise((resolve) => {
    onDocumentState(doc, isDocumentComplete, resolve);
  });
}
