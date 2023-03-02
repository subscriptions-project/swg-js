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

function getReadyState(doc: Document): string {
  return doc['readyState'];
}

/**
 * Whether the document is ready.
 */
export function isDocumentReady(doc: Document): boolean {
  const readyState = getReadyState(doc);
  return readyState !== 'loading' && readyState !== 'uninitialized';
}

/**
 * Calls the callback when document is ready.
 */
export function onDocumentReady(
  doc: Document,
  callback: (doc: Document) => void
) {
  onDocumentState(doc, isDocumentReady, callback);
}

/**
 * Calls the callback once when document's state satisfies the condition.
 * @param {!Document} doc
 * @param {function(!Document):boolean} condition
 * @param {function(!Document)} callback
 */
function onDocumentState(
  doc: Document,
  condition: (doc: Document) => boolean,
  callback: (doc: Document) => void
) {
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
export function whenDocumentReady(doc: Document): Promise<Document> {
  return new Promise((resolve) => {
    onDocumentReady(doc, resolve);
  });
}
