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

const PREFIX = 'subscribe.google.com';
const STORAGE_DELIMITER = ',';
const WEEK_IN_MILLIS = 604800000;

/**
 * This class is responsible for the storage of data in session storage. If
 * you're looking to store data in local storage, see
 * src/runtime/local-storage.LocalStorage.
 */
export class Storage {
  /**
   * @param {!Window} win
   */
  constructor(win) {
    /** @private @const {!Window} */
    this.win_ = win;

    /** @private @const {!Object<string, !Promise<?string>>} */
    this.values_ = {};
  }

  /**
   * @param {string} key
   * @param {boolean=} useLocalStorage
   * @return {!Promise<?string>}
   */
  get(key, useLocalStorage = false) {
    if (!this.values_[key]) {
      this.values_[key] = new Promise((resolve) => {
        const storage = useLocalStorage
          ? this.win_.localStorage
          : this.win_.sessionStorage;
        if (storage) {
          try {
            resolve(storage.getItem(storageKey(key)));
          } catch (e) {
            // Ignore error.
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }
    return this.values_[key];
  }

  /**
   * @param {string} key
   * @param {string} value
   * @param {boolean=} useLocalStorage
   * @return {!Promise}
   */
  set(key, value, useLocalStorage = false) {
    this.values_[key] = Promise.resolve(value);
    return new Promise((resolve) => {
      const storage = useLocalStorage
        ? this.win_.localStorage
        : this.win_.sessionStorage;
      if (storage) {
        try {
          storage.setItem(storageKey(key), value);
        } catch (e) {
          // Ignore error.
        }
      }
      resolve();
    });
  }

  /**
   * @param {string} key
   * @param {boolean=} useLocalStorage
   * @return {!Promise}
   */
  remove(key, useLocalStorage = false) {
    delete this.values_[key];
    return new Promise((resolve) => {
      const storage = useLocalStorage
        ? this.win_.localStorage
        : this.win_.sessionStorage;
      if (storage) {
        try {
          storage.removeItem(storageKey(key));
        } catch (e) {
          // Ignore error.
        }
      }
      resolve();
    });
  }

  /**
   * Stores the current timestamp to local storage, under the storageKey provided.
   * Removes timestamps older than a week in the process.
   * @param {string} storageKey
   */
  async storeEvent(storageKey) {
    const timestamps = await this.getEvent(storageKey);
    timestamps.push(Date.now());
    const valueToStore = this.serializeTimestamps_(timestamps);
    this.set(storageKey, valueToStore, /* useLocalStorage */ true);
  }

  /**
   * Retrieves timestamps from local storage, under the storageKey provided.
   * Filters out timestamps older than a week.
   * @param {string} storageKey
   * @return {!Promise<!Array<number>>}
   */
  async getEvent(storageKey) {
    const value = await this.get(storageKey, /* useLocalStorage */ true);
    return this.pruneTimestamps_(this.deserializeTimestamps_(value));
  }

  /**
   * Converts a stored series of timestamps to an array of numbers.
   * @param {?string} value
   * @return {!Array<number>}
   */
  deserializeTimestamps_(value) {
    if (value === null) {
      return [];
    }
    return value
      .split(STORAGE_DELIMITER)
      .map((dateStr) => parseInt(dateStr, 10));
  }

  /**
   * Converts an array of numbers to a concatenated string of timestamps for
   * storage.
   * @param {!Array<number>} timestamps
   * @return {string}
   */
  serializeTimestamps_(timestamps) {
    return timestamps.join(STORAGE_DELIMITER);
  }

  /**
   * Filters out values that are older than a week.
   * @param {!Array<number>} timestamps
   * @return {!Array<number>}
   */
  pruneTimestamps_(timestamps) {
    const now = Date.now();
    let sliceIndex = timestamps.length;
    for (let i = 0; i < timestamps.length; i++) {
      // The arrays are sorted in time, so if you find a time in the array
      // that's within the week boundary, we can skip over the remainder because
      // the rest of the array else should be too.
      if (now - timestamps[i] <= WEEK_IN_MILLIS) {
        sliceIndex = i;
        break;
      }
    }
    return timestamps.slice(sliceIndex);
  }
}

/**
 * @param {string} key
 * @return {string}
 */
function storageKey(key) {
  return PREFIX + ':' + key;
}
