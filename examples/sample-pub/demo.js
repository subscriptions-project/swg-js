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

  this.subscriptions.setOnEntitlementsResponse(this.onEntitlements_.bind(this));
  this.subscriptions.setOnLoginRequest(this.loginRequest_.bind(this));
  this.subscriptions.setOnLinkComplete(this.linkComplete_.bind(this));
  this.subscriptions.setOnPaymentResponse(this.subscribeResponse_.bind(this));

  /** @const {?Entitlements} */
  this.entitlements = null;
}

/** */
DemoPaywallController.prototype.start = function () {
  log('DemoPaywallController started');
  this.subscriptions.start();
};

/** @private */
DemoPaywallController.prototype.onEntitlements_ = async function (
  entitlementsPromise
) {
  let entitlements;
  try {
    entitlements = await entitlementsPromise;
  } catch (reason) {
    log('entitlements failed: ', reason);
    throw reason;
  }

  log('got entitlements: ', entitlements, entitlements.enablesThis());
  if (this.shouldCreateAccount_(entitlements)) {
    this.createAccount_(entitlements);
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
};

/**
 * The simplest possible implementation: the paywall is now open. A more
 * sophisticated implementation could fetch more data, or set cookies and
 * refresh the whole page.
 * @private
 */
DemoPaywallController.prototype.openPaywall_ = function () {
  log('open paywall');
  document.documentElement.classList.add('open-paywall');
};

/**
 * The subscription has been complete.
 * @param {!Promise<!SubscribeResponse>} responsePromise
 * @private
 */
DemoPaywallController.prototype.subscribeResponse_ = async function (
  responsePromise
) {
  let response;
  try {
    response = await responsePromise;
  } catch (reason) {
    log('subscription response failed: ', reason);
    throw reason;
  }

  // TODO: Start account creation flow.
  log('got subscription response', response);
  const toast = document.getElementById('creating_account_toast');
  const userEl = document.getElementById('creating_account_toast_user');
  userEl.textContent = response.userData.email;
  toast.style.display = 'block';

  // TODO: wait for account creation to be complete.
  setTimeout(async () => {
    await response.complete();
    log('subscription has been confirmed');

    // Open the content.
    this.subscriptions.reset();
    this.start();
    toast.style.display = 'none';
  }, 3000);
};

/**
 * @param {!Entitlements} entitlements
 * @return {boolean}
 * @private
 */
DemoPaywallController.prototype.shouldCreateAccount_ = function (entitlements) {
  const accountFound = this.knownAccount || true;
  if (accountFound) {
    // Nothing needs to be completed.
    return false;
  }
  if (!entitlements.getEntitlementForSource('google')) {
    // No Google entitlement.
    return false;
  }

  return true;
};

/**
 * @param {!Entitlements} entitlements
 * @private
 */
DemoPaywallController.prototype.createAccount_ = async function (entitlements) {
  log('start deferred account creation');
  const response = await this.subscriptions.completeDeferredAccountCreation({
    entitlements,
  });

  // TODO: Start deferred account creation flow.
  log('got deferred account response', response);
  this.knownAccount = true;
  const toast = document.getElementById('creating_account_toast');
  const userEl = document.getElementById('creating_account_toast_user');
  userEl.textContent = 'deferred/' + response.userData.email;
  toast.style.display = 'block';

  // TODO: wait for account creation to be complete.
  setTimeout(async () => {
    await response.complete();
    log('subscription has been confirmed');

    // Open the content.
    this.subscriptions.reset();
    this.start();
    toast.style.display = 'none';
  }, 3000);
};

/**
 * Login requested. This sample starts linking flow.
 * @private
 */
DemoPaywallController.prototype.loginRequest_ = function () {
  log('login request');
  this.subscriptions.linkAccount();
};

/**
 * Linking has been complete. Possibly we have permissions now.
 * @private
 */
DemoPaywallController.prototype.linkComplete_ = function () {
  log('linking complete');
  this.subscriptions.reset();
  this.start();
};
