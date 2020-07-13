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
 * Triple zero width space.
 *
 * This is added to user error messages, so that we can later identify
 * them, when the only thing that we have is the message. This is the
 * case in many browsers when the global exception handler is invoked.
 *
 * @const {string}
 */
export const AMP_USER_ERROR_SENTINEL = '\u200B\u200B\u200B';

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
   * Constructor.
   *
   * opt_suffix will be appended to error message to identify the type of the
   * error message. We can't rely on the error object to pass along the type
   * because some browsers do not have this param in its window.onerror API.
   * See:
   * https://blog.sentry.io/2016/01/04/client-javascript-reporting-window-onerror.html
   *
   * @param {string=} opt_suffix
   */
  constructor(opt_suffix = '') {
    /** @private @const {string} */
    this.suffix_ = opt_suffix;
  }

  /**
   * Modifies an error before reporting, such as to add metadata.
   * @param {!Error} error
   * @private
   */
  prepareError_(error) {
    if (this.suffix_) {
      if (!error.message) {
        error.message = this.suffix_;
      } else if (error.message.indexOf(this.suffix_) === -1) {
        error.message = this.suffix_;
      }
    }
  }

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
   * Creates an error object with its expected property set to true. Used for
   * expected failure states (ex. incorrect configuration, localStorage
   * unavailable due to browser settings, etc.) as opposed to unexpected
   * breakages/failures.
   * @param {...*} var_args
   * @return {!Error}
   */
  createExpectedError(var_args) {
    const error = createErrorVargs.apply(
      null,
      Array.prototype.slice.call(arguments)
    );
    this.prepareError_(error);
    error.expected = true;
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

  /**
   * Throws an error and marks with an expected property.
   * @param {...*} var_args
   * @throws {!Error}
   */
  expectedError(var_args) {
    throw this.createExpectedError.apply(this, arguments);
  }
}

const userLogger = new ErrorLogger(
  self.__AMP_TOP ? AMP_USER_ERROR_SENTINEL : ''
);
const devLogger = new ErrorLogger();

export const user = () => userLogger;
export const dev = () => devLogger;
