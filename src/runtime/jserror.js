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
 */
export class JsError {
  /**
   * @param {!../model/doc.Doc} doc
   */
  constructor(doc) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;
  }

  /**
   * @param {...(!Error|string)} args
   * @return {!Promise}
   */
  async error(...args) {
    // Wait for next task.
    await 0;

    // Combine args to create error.
    const error = createErrorFromArgs(args);

    // Only report error once.
    if (error.reported) {
      return;
    }

    // Send error.
    const img = this.doc_.getWin().document.createElement('img');
    img.src =
      '$frontend$/_/SubscribewithgoogleClientUi/jserror' +
      '?error=' +
      encodeURIComponent(String(error)) +
      '&script=' +
      encodeURIComponent('$frontend$/swg/js/v1/swg.js') +
      '&line=' +
      (error.lineNumber || 1) +
      '&trace=' +
      encodeURIComponent(error.stack);

    // Avoid reporting error twice.
    error.reported = true;
  }
}

/**
 * @param {!Array<!Error|string>} args
 * @return {!Error}
 */
function createErrorFromArgs(args) {
  let error = null;
  let message = '';
  for (const arg of args) {
    if (arg instanceof Error && !error) {
      error = duplicateErrorIfNecessary(arg);
    } else {
      if (message) {
        message += ' ';
      }
      message += arg;
    }
  }

  if (!error) {
    error = new Error(message);
  } else if (message) {
    error.message = message + ': ' + error.message;
  }
  return error;
}

/**
 * Some exceptions (DOMException, namely) have read-only message.
 * @param {!Error} error
 * @return {!Error}
 */
function duplicateErrorIfNecessary(error) {
  const messageProperty = Object.getOwnPropertyDescriptor(error, 'message');
  if (messageProperty && messageProperty.writable) {
    return error;
  }

  const {message, stack} = error;
  const e = new Error(message);
  // Copy all the extraneous things we attach.
  for (const prop in error) {
    e[prop] = error[prop];
  }
  // Ensure these are copied.
  e.stack = stack;
  return e;
}
