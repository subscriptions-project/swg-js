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
 * Demo paywall controller to demonstrate some key features.
 * @param {!Subscriptions} subscriptions
 */
function DemoPaywallController(subscriptions) {
  /** @const {!Subscriptions} */
  this.subscriptions = subscriptions;

  this.subscriptions.setOnEntitlementsResponse(
      this.onEntitlements_.bind(this));
  this.subscriptions.setOnLoginRequest(this.loginRequest_.bind(this));
  this.subscriptions.setOnLinkComplete(this.linkComplete_.bind(this));
  this.subscriptions.setOnPaymentResponse(
      this.subscribeResponse_.bind(this));

  /** @const {?Entitlements} */
  this.entitlements = null;
};

/** */
DemoPaywallController.prototype.start = function() {
  log('DemoPaywallController started');
  this.subscriptions.start();
};

/** @private */
DemoPaywallController.prototype.onEntitlements_ = function(entitlementsPromise) {
  entitlementsPromise.then((function(entitlements) {
    log('got entitlements: ', entitlements, entitlements.enablesThis());
    if (this.completeDeferredAccountCreation_(entitlements)) {
      return;
    }
    if (entitlements && entitlements.enablesThis()) {
      // Entitlements available: open access.
      this.openPaywall_();
      entitlements.ack();
    } else {
      // In a simplest case, just launch offers flow.
      this.subscriptions.showOffers();
    }
  }).bind(this), function(reason) {
    log('entitlements failed: ', reason);
    throw reason;
  });
};

/**
 * The simplest possible implementation: they paywall is now open. A more
 * sophisticated implementation could fetch more data, or set cookies and
 * refresh the whole page.
 * @private
 */
DemoPaywallController.prototype.openPaywall_ = function() {
  log('open paywall');
  document.documentElement.classList.add('open-paywall');
};

/**
 * The subscription has been complete.
 * @param {!Promise<!SubscribeResponse>} promise
 * @private
 */
DemoPaywallController.prototype.subscribeResponse_ = function(promise) {
  promise.then((function(response) {
    // TODO: Start account creation flow.
    log('got subscription response', response);
    var toast = document.getElementById('creating_account_toast');
    var userEl = document.getElementById('creating_account_toast_user');
    userEl.textContent = response.userData.email;
    toast.style.display = 'block';
    // TODO: wait for account creation to be complete.
    setTimeout((function() {
      response.complete().then((function() {
        log('subscription has been confirmed');
        // Open the content.
        this.subscriptions.reset();
        this.start();
      }).bind(this));
      toast.style.display = 'none';
    }).bind(this), 3000);
  }).bind(this), function(reason) {
    log('subscription response failed: ', reason);
    throw reason;
  });
};

/**
 * @param {!Entitlements} entitlements
 * @return {!Promise|undefined}
 * @private
 */
DemoPaywallController.prototype.completeDeferredAccountCreation_ = function(
    entitlements) {
  // TODO(dvoytenko): decide when completion is needed for demo.
  var accountFound = this.knownAccount || true;
  if (accountFound) {
    // Nothing needs to be completed.
    return;
  }
  if (!entitlements.getEntitlementForSource('google')) {
    // No Google entitlement.
    return;
  }
  log('start deferred account creation');
  return this.subscriptions.completeDeferredAccountCreation({
    entitlements: entitlements,
  }).then((function(response) {
    // TODO: Start deferred account creation flow.
    log('got deferred account response', response);
    this.knownAccount = true;
    var toast = document.getElementById('creating_account_toast');
    var userEl = document.getElementById('creating_account_toast_user');
    userEl.textContent = 'deferred/' + response.userData.email;
    toast.style.display = 'block';
    // TODO: wait for account creation to be complete.
    setTimeout((function() {
      response.complete().then((function() {
        log('subscription has been confirmed');
        // Open the content.
        this.subscriptions.reset();
        this.start();
      }).bind(this));
      toast.style.display = 'none';
    }).bind(this), 3000);
  }).bind(this));
};

/**
 * Login requested. This sample starts linking flow.
 * @private
 */
DemoPaywallController.prototype.loginRequest_ = function() {
  log('login request');
  this.subscriptions.linkAccount();
};

/**
 * Linking has been complete. Possibly we have permissions now.
 * @private
 */
DemoPaywallController.prototype.linkComplete_ = function() {
  log('linking complete');
  this.subscriptions.reset();
  this.start();
};
