/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

function log() {
  var var_args = Array.prototype.slice.call(arguments, 0);
  var_args.unshift('[publisher.js]');
  console.log.apply(console, var_args);
}

log('started');

/**
 * Add subsciptions when ready.
 * @param {function()} callback
 */
function whenReady(callback) {
  (self.SUBSCRIPTIONS = self.SUBSCRIPTIONS || []).push(subscriptions => {
    callback(subscriptions);
  });
}

// Callbacks.
whenReady(function(subscriptions) {
  subscriptions.setOnLinkComplete(function() {
    log('link complete');
  });
});

/**
 * Starts the entitlements flow.
 */
function getEntitlements() {
  whenReady(function(subscriptions) {
    subscriptions.getEntitlements().then(entitlements => {
      log('entitlements: ', entitlements);
    });
  });
}

/**
 * Starts the offers flow.
 */
function startOffersFlow() {
  whenReady(function(subscriptions) {
    subscriptions.showOffers();
  });
}

/**
 * Starts the linking accounts flow.
 */
function startLinkAccountsFlow() {
  whenReady(function(subscriptions) {
    subscriptions.linkAccount();
  });
}


// startOffersFlow();
startLinkAccountsFlow();
// getEntitlements();
