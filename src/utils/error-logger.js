/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

/**
 * @param {...*} var_args
 * @return {!Error}
 */
function createErrorVargs(var_args) {
  let error = null;
  let message = '';
  for (let i = 0; i < arguments.length; i++) {
    const arg = arguments[i];
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

/** Helper class for throwing standardized errors. */
export class ErrorLogger {
  /**
   * Modifies an error before reporting, such as to add metadata.
   * @param {!Error} error
   * @private
   */
  prepareError_(error) {}

  /**
   * Creates an error.
   * @param {...*} var_args
   * @return {!Error}
   */
  createError(var_args) {
    const error = createErrorVargs.apply(
      null,
      Array.prototype.slice.call(arguments)
    );
    this.prepareError_(error);
    return error;
  }

  /**
   * Throws an error.
   * @param {...*} var_args
   * @throws {!Error}
   */
  error(var_args) {
    throw this.createError.apply(this, arguments);
  }
}
