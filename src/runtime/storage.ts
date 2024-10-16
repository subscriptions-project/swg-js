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

import {ExperimentFlags} from './experiment-flags';
import {PageConfig} from '../model/page-config';
import {StorageKeysWithoutPublicationIdSuffix} from '../utils/constants';
import {isExperimentOn} from './experiments';

const PREFIX = 'subscribe.google.com';
const WEEK_IN_MILLIS = 604800000;

/**
 * This class is responsible for the storage of data in session storage. If
 * you're looking to store data in local storage, see
 * src/runtime/local-storage.LocalStorage.
 */
export class Storage {
  private readonly win_: Window;
  private readonly pageConfig_: PageConfig;
  private readonly values_: {[key: string]: Promise<string | null>};

  constructor(win: Window, pageConfig: PageConfig) {
    this.win_ = win;
    this.pageConfig_ = pageConfig;
    this.values_ = {};
  }

  async get(baseKey: string, useLocalStorage = false): Promise<string | null> {
    // The old version of storage key without publication identifier.
    // To be deprecated in favor of the new version of key.
    const oldKey = this.getStorageKeyWithoutPublicationId_(baseKey);
    // The new version of storage key with publication identifier.
    const newKey = this.getStorageKeyMaybeWithPublicationId_(baseKey);

    const valueWithNewKey = await this.getInternal_(newKey, useLocalStorage);
    if (valueWithNewKey !== null) {
      return valueWithNewKey;
    } else {
      return this.getInternal_(oldKey, useLocalStorage);
    }
  }

  private getInternal_(
    finalKey: string,
    useLocalStorage: boolean
  ): Promise<string | null> {
    if (!this.values_[finalKey]) {
      this.values_[finalKey] = new Promise((resolve) => {
        const storage = useLocalStorage
          ? this.win_.localStorage
          : this.win_.sessionStorage;
        if (storage) {
          try {
            resolve(storage.getItem(finalKey));
          } catch (e) {
            // Ignore error.
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    }
    return this.values_[finalKey];
  }

  async set(
    baseKey: string,
    value: string,
    useLocalStorage = false
  ): Promise<void> {
    // The old version of storage key without publication identifier.
    // To be deprecated in favor of the new version of key.
    const oldKey = this.getStorageKeyWithoutPublicationId_(baseKey);
    // The new version of storage key with publication identifier.
    const newKey = this.getStorageKeyMaybeWithPublicationId_(baseKey);
    const valueWithNewKey = await this.getInternal_(newKey, useLocalStorage);

    // If a value for the new key already exists, we use the new key even if the
    // experiment is deactivated in the current session.
    if (
      valueWithNewKey !== null ||
      isExperimentOn(
        this.win_,
        ExperimentFlags.ENABLE_PUBLICATION_ID_SUFFIX_FOR_STORAGE_KEY
      )
    ) {
      // Remove value stored in the old key for transition from control to
      // experiment treatment.
      await this.removeInternal_(oldKey, useLocalStorage);
      return this.setInternal_(newKey, value, useLocalStorage);
    } else {
      return this.setInternal_(oldKey, value, useLocalStorage);
    }
  }

  private setInternal_(
    finalKey: string,
    value: string,
    useLocalStorage: boolean
  ): Promise<void> {
    this.values_[finalKey] = Promise.resolve(value);
    return new Promise((resolve) => {
      const storage = useLocalStorage
        ? this.win_.localStorage
        : this.win_.sessionStorage;
      if (storage) {
        try {
          storage.setItem(finalKey, value);
        } catch (e) {
          // Ignore error.
        }
      }
      resolve();
    });
  }

  async remove(baseKey: string, useLocalStorage = false): Promise<void> {
    // The old version of storage key without publication identifier.
    // To be deprecated in favor of the new version of key.
    const oldKey = this.getStorageKeyWithoutPublicationId_(baseKey);
    // The new version of storage key with publication identifier.
    const newKey = this.getStorageKeyMaybeWithPublicationId_(baseKey);
    const valueWithNewKey = await this.getInternal_(newKey, useLocalStorage);

    // If a value for the new key already exists, we use the new key even if the
    // experiment is deactivated in the current session.
    if (
      valueWithNewKey !== null ||
      isExperimentOn(
        this.win_,
        ExperimentFlags.ENABLE_PUBLICATION_ID_SUFFIX_FOR_STORAGE_KEY
      )
    ) {
      return this.removeInternal_(newKey, useLocalStorage);
    }
    return this.removeInternal_(oldKey, useLocalStorage);
  }

  private removeInternal_(
    finalKey: string,
    useLocalStorage: boolean
  ): Promise<void> {
    delete this.values_[finalKey];
    return new Promise((resolve) => {
      const storage = useLocalStorage
        ? this.win_.localStorage
        : this.win_.sessionStorage;
      if (storage) {
        try {
          storage.removeItem(finalKey);
        } catch (e) {
          // Ignore error.
        }
      }
      resolve();
    });
  }

  /**
   * Returns a storage key with a swg prefix but without a publication_id suffix.
   * It should be replaced with getStorageKeyWithPublicationId unless intended.
   * See more details in go/sut-pub-id-validation-1-pager.
   */
  private getStorageKeyWithoutPublicationId_(baseKey: string): string {
    return PREFIX + ':' + baseKey;
  }

  /**
   * Returns a storage key with a swg prefix and a publication_id suffix.
   */
  private getStorageKeyMaybeWithPublicationId_(baseKey: string): string {
    if (
      Object.values(StorageKeysWithoutPublicationIdSuffix).includes(baseKey)
    ) {
      return this.getStorageKeyWithoutPublicationId_(baseKey);
    }
    const publicationId = this.pageConfig_.getPublicationId();
    return PREFIX + ':' + baseKey + ':' + publicationId;
  }
}

/**
 * Filters out values that are older than a week.
 */
export function pruneTimestamps(
  timestamps: number[],
  timestampLifespan = WEEK_IN_MILLIS
): number[] {
  const now = Date.now();
  let sliceIndex = timestamps.length;
  for (let i = 0; i < timestamps.length; i++) {
    // The arrays are sorted in time, so if you find a time in the array
    // that's within the week boundary, we can skip over the remainder because
    // the rest of the array else should be too.
    if (now - timestamps[i] <= timestampLifespan) {
      sliceIndex = i;
      break;
    }
  }
  return timestamps.slice(sliceIndex);
}
