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
  private readonly win_: Window;
  private readonly values_: {[key: string]: Promise<string | null>};

  constructor(win: Window) {
    this.win_ = win;

    this.values_ = {};
  }

  get(key: string, useLocalStorage = false): Promise<string | null> {
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

  set(key: string, value: string, useLocalStorage = false): Promise<void> {
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

  remove(key: string, useLocalStorage = false): Promise<void> {
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
   */
  async storeEvent(storageKey: string): Promise<void> {
    const timestamps = await this.getEvent(storageKey);
    timestamps.push(Date.now());
    const valueToStore = this.serializeTimestamps_(timestamps);
    this.set(storageKey, valueToStore, /* useLocalStorage */ true);
  }

  /**
   * Retrieves timestamps from local storage, under the storageKey provided.
   * Filters out timestamps older than a week.
   */
  async getEvent(storageKey: string): Promise<number[]> {
    const value = await this.get(storageKey, /* useLocalStorage */ true);
    return this.pruneTimestamps_(this.deserializeTimestamps_(value));
  }

  /**
   * Converts a stored series of timestamps to an array of numbers.
   */
  deserializeTimestamps_(value: string | null): number[] {
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
   */
  serializeTimestamps_(timestamps: number[]): string {
    return timestamps.join(STORAGE_DELIMITER);
  }

  /**
   * Filters out values that are older than a week.
   */
  pruneTimestamps_(timestamps: number[]): number[] {
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

function storageKey(key: string): string {
  return PREFIX + ':' + key;
}
