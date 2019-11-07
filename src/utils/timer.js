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

import {log} from './log';

/**
 * Helper with all things Timer.
 */
export class Timer {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @const {!Window} */
    this.win = win;

    /** @private @const {!Promise}  */
    this.resolved_ = Promise.resolve();

    this.taskCount_ = 0;

    this.canceled_ = {};
  }

  /**
   * Runs the provided callback after the specified delay. This uses a micro
   * task for 0 or no specified time. This means that the delay will actually
   * be close to 0 and this will NOT yield to the event queue.
   *
   * Returns the timer ID that can be used to cancel the timer (cancel method).
   * @param {!function()} callback
   * @param {number=} delay
   * @return {number|string}
   */
  delay(callback, delay) {
    if (!delay) {
      // For a delay of zero,  schedule a promise based micro task since
      // they are predictably fast.
      const id = 'p' + this.taskCount_++;
      this.resolved_
        .then(() => {
          if (this.canceled_[id]) {
            delete this.canceled_[id];
            return;
          }
          callback();
        })
        .catch(log);
      return id;
    }
    const wrapped = () => {
      try {
        callback();
      } catch (e) {
        log(e);
        throw e;
      }
    };
    return this.win.setTimeout(wrapped, delay);
  }

  /**
   * Cancels the previously scheduled callback.
   * @param {number|string|null} timeoutId
   */
  cancel(timeoutId) {
    if (typeof timeoutId == 'string') {
      this.canceled_[timeoutId] = true;
      return;
    }
    this.win.clearTimeout(timeoutId);
  }

  /**
   * Returns a promise that will resolve after the delay. Optionally, the
   * resolved value can be provided as result argument.
   * @param {number=} delay
   * @return {!Promise}
   */
  promise(delay) {
    return new Promise(resolve => {
      // Avoid wrapping in closure if no specific result is produced.
      const timerKey = this.delay(resolve, delay);
      if (timerKey == -1) {
        throw new Error('Failed to schedule timer.');
      }
    });
  }

  /**
   * Returns a promise that will fail after the specified delay. Optionally,
   * this method can take racePromise parameter. In this case, the
   * resulting promise will either fail when the specified delay expires or
   * will resolve based on the racePromise, whichever happens first.
   * @param {number} delay
   * @param {?Promise<RESULT>|undefined} racePromise
   * @param {string=} message
   * @return {!Promise<RESULT>}
   * @template RESULT
   */
  timeoutPromise(delay, racePromise, message) {
    let timerKey;
    const delayPromise = new Promise((_resolve, reject) => {
      timerKey = this.delay(() => {
        reject(new Error(message || 'timeout'));
      }, delay);

      if (timerKey == -1) {
        throw new Error('Failed to schedule timer.');
      }
    });
    if (!racePromise) {
      return delayPromise;
    }
    const cancel = () => {
      this.cancel(timerKey);
    };
    racePromise.then(cancel, cancel);
    return Promise.race([delayPromise, racePromise]);
  }

  /**
   * Returns a promise that resolves after `predicate` returns true.
   * Polls with interval `delay`
   * @param {number} delay
   * @param {function():boolean} predicate
   * @return {!Promise}
   */
  poll(delay, predicate) {
    return new Promise(resolve => {
      const interval = /** @type {number} */ (this.win.setInterval(() => {
        if (predicate()) {
          this.win.clearInterval(interval);
          resolve();
        }
      }, delay));
    });
  }
}
