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
'use strict';


/**
 * Demo paywall controller to demonstrate some key features.
 */
class DemoPaywallController {

  /**
   * @param {!Subscriptions} subscriptions
   */
  constructor(subscriptions) {
    /** @const {!Subscriptions} */
    this.subscriptions = subscriptions;

    this.subscriptions.setOnEntitlementsResponse(
        this.onEntitlements_.bind(this));
    this.subscriptions.setOnLoginRequest(this.loginRequest_.bind(this));
    this.subscriptions.setOnLinkComplete(this.linkComplete_.bind(this));
    this.subscriptions.setOnSubscribeResponse(
        this.subscribeResponse_.bind(this));

    /** @const {?Entitlements} */
    this.entitlements = null;
  }

  start() {
    log('DemoPaywallController started');
    this.subscriptions.start();
  }

  /** @private */
  onEntitlements_(entitlementsPromise) {
    entitlementsPromise.then(entitlements => {
      log('got entitlements: ', entitlements, entitlements.enablesThis());
      if (entitlements && entitlements.enablesThis()) {
        // Entitlements available: open access.
        this.openPaywall_();
      } else {
        // In a simplest case, just launch offers flow.
        this.subscriptions.showOffers();
      }
    }, reason => {
      log('entitlements failed: ', reason);
      throw reason;
    });
  }

  /**
   * The simplest possible implementation: they paywall is now open. A more
   * sophisticated implementation could fetch more data, or set cookies and
   * refresh the whole page.
   * @private
   */
  openPaywall_() {
    log('open paywall');
    document.documentElement.classList.add('open-paywall');
  }

  /**
   * The subscription has been complete.
   * @param {!Promise<!SubscribeResponse>} promise
   * @private
   */
  subscribeResponse_(promise) {
    promise.then(response => {
      // TODO: Start account creation flow.
      log('got subscription response', response);
      var toast = document.getElementById('creating_account_toast');
      var userEl = document.getElementById('creating_account_toast_user');
      userEl.textContent = response.userData.email;
      toast.style.display = 'block';
      // TODO: wait for account creation to be complete.
      setTimeout(() => {
        response.complete().then(() => {
          log('subscription has been confirmed');
          // Open the content.
          this.subscriptions.reset();
          this.start();
        });
        toast.style.display = 'none';
      }, 3000);
    }, reason => {
      log('subscription response failed: ', reason);
      throw reason;
    });
  }

  /**
   * Login requested. This sample starts linking flow.
   * @private
   */
  loginRequest_() {
    log('login request');
    this.subscriptions.linkAccount();
  }

  /**
   * Linking has been complete. Possibly we have permissions now.
   * @private
   */
  linkComplete_() {
    log('linking complete');
    this.subscriptions.reset();
    this.start();
  }
}
