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
 * Helper with all things Timer.
 */
import {uuidFast} from '../../third_party/random_uuid/uuid-swg';

export class TransactionId {
  /**
   * @param {!./deps.DepsDef} deps
   */
  constructor(deps) {
    /** @private @const {!Storage} */
    this.storage_ = deps.storage();
  }

  /**
   * Returns the current transaction id
   *  @return {!Promise<string>}
   */
  get() {
    return this.storage_.get('transaction_id').then(id => {
      if (!id) {
        id = uuidFast();
        this.storage_.set('transaction_id', id);
      }
      return id;
    });
  }

  /**
   * Resets the transaction id
   * @return {!Promise}
   */
  reset() {
    return this.storage_.remove('transaction_id');
  }
}
