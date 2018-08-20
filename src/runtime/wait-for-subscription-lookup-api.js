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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {
  DeferredAccountCreationResponse,
} from '../api/deferred-account-creation';
import {feArgs, feUrl} from './services';


export class WaitForSubscriptionLookupApi {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {?Promise} accountPromise
   */
  constructor(deps, accountPromise) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private {?Promise} */
    this.openViewPromise_ = null;

    /** @private {?Promise} */
    this.accountPromise_ = accountPromise || null;

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/waitforsubscriptionlookupiframe'),
        feArgs({
          publicationId: deps.pageConfig().getPublicationId(),
          productId: deps.pageConfig().getProductId(),
        }),
        /* shouldFadeBody */ true
    );
  }

  /**
   * Starts the Login Flow.
   * @return {!Promise}
   */
  start() {
    this.openViewPromise_ = this.dialogManager_.openView(
        this.activityIframeView_);
    this.activityIframeView_.acceptResult().then(result => {
      console.log('result from wait for subscription look up:', result);
        // The flow is complete.
        this.dialogManager_.completeView(this.activityIframeView_);
    }, reason => {
      console.log('result error from wait for subscription look up:', reason);
    });
    this.activityIframeView_.onMessage(data => {
      console.log('message from wait for subscription look up: ', data);
    }, reason => {
      console.log('error from wait for subscription look up: ', reason);
    })
    return this.accountPromise_.then(account => {
      console.log('account was found from wait for subscription look up:', account);
      // Account was found.
      this.dialogManager_.completeView(this.activityIframeView_);
      return account;
    }, reason => {
      this.dialogManager_.completeView(this.activityIframeView_);
      throw reason;
    });
  }
}
