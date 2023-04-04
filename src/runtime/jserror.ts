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
import {FRONTEND} from '../constants';

interface ReportableError extends Error {
  /** Helps avoid reporting the same error multiple times. */
  reported?: boolean;

  /**
   * Non-standard
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/lineNumber
   */
  lineNumber?: number;

  /**
   * Non-standard
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/Stack
   */
  stack?: string;
}

export class JsError {
  constructor(private readonly doc_: Doc) {}

  async error(...args: Array<ReportableError | string>): Promise<void> {
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
      `${FRONTEND}/_/SubscribewithgoogleClientUi/jserror` +
      '?error=' +
      encodeURIComponent(String(error)) +
      '&script=' +
      encodeURIComponent(`${FRONTEND}/swg/js/v1/swg.js`) +
      '&line=' +
      (error.lineNumber || 1) +
      '&trace=' +
      encodeURIComponent(error.stack || '');

    // Avoid reporting error twice.
    error.reported = true;
  }
}

function createErrorFromArgs(args: Array<Error | string>): ReportableError {
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
 */
function duplicateErrorIfNecessary(error: ReportableError): ReportableError {
  const messageProperty = Object.getOwnPropertyDescriptor(error, 'message');
  if (messageProperty && messageProperty.writable) {
    return error;
  }

  const {lineNumber, message, reported, stack} = error;
  const e: ReportableError = new Error(message);
  // Copy all the extraneous things we attach.
  e.lineNumber = lineNumber;
  e.stack = stack;
  e.reported = reported;

  return e;
}
