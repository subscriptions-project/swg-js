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

import {createAbortError, isAbortError} from 'activity-ports';

/**
 * Whether the specified error is an AbortError type.
 * See https://heycam.github.io/webidl/#aborterror.
 * @param {*} error
 * @return {boolean}
 */
export function isCancelError(error) {
  return isAbortError(error);
}

/**
 * Creates or emulates a DOMException of AbortError type.
 * See https://heycam.github.io/webidl/#aborterror.
 * @param {!Window} win
 * @param {string=} message
 * @return {!DOMException}
 */
export function createCancelError(win, message) {
  return createAbortError(win, message);
}

/**
 * A set of error utilities combined in a class to allow easy stubbing in tests.
 */
export class ErrorUtils {
  /**
   * @param {!Error} error
   */
  static throwAsync(error) {
    setTimeout(() => {
      throw error;
    });
  }
}
