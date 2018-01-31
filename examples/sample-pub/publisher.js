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
'use strict';

function log() {
  if (!console || !console.log) {
    return;
  }
  var var_args = Array.prototype.slice.call(arguments, 0);
  var_args.unshift('[publisher.js]');
  console.log.apply(console, var_args);
}

log('started');

// Available for testing only. A very bad idea to have a global like this.
var globalSubscriptions;

/**
 * Add subsciptions when ready.
 * @param {function()} callback
 */
function whenReady(callback) {
  (self.SUBSCRIPTIONS = self.SUBSCRIPTIONS || []).push(function(subscriptions) {
    globalSubscriptions = subscriptions;
    callback(subscriptions);
  });
}

// Callbacks.
whenReady(function(subscriptions) {
  function eventCallback(eventName) {
    return function(promise) {
      promise.then(function(response) {
        log(eventName, response);
      }, function(reason) {
        log(eventName + 'failed', reason);
      });
    };
  }
  subscriptions.setOnLinkComplete(eventCallback('link'));
  subscriptions.setOnSubscribeResponse(eventCallback('subscribe'));
});

/**
 * Selects the flow based on the URL query parameter.
 * The query parameter is the name of the function defined in runtime.
 * Defaults to 'showOffers'.
 * Current valid values are: 'showOffers', 'linkAccount', 'getEntitlements'.
 * @param {string} flow
 * @param {...} var_args
 */
function startFlow(flow, var_args) {
  var_args = Array.prototype.slice.call(arguments, 1);
  whenReady(function(subscriptions) {
    var flowFunc = subscriptions[flow];
    var flows = Object.keys(subscriptions);
    if (!(typeof flowFunc == 'function')) {
      throw new Error(
          `Flow "${flow}" not found: Available flows: "${flows}"`);
    }
    log('starting flow', flow, '(', var_args, ')', ` {${flows}}`);
    var result = flowFunc.apply(subscriptions, var_args);
    Promise.resolve(result).then(function() {
      log('flow complete', flow);
    });
  });
}


/**
 * Selects the flow based on the URL query parameter.
 * The query parameter is the name of the function defined in runtime.
 * Defaults to 'showOffers'.
 * Current valid values are: 'showOffers', 'linkAccount', 'getEntitlements'.
 */
function startFlowAuto() {
  var flow = window.location.href.split('?')[1] || 'demo';
  if (flow == 'none') {
    return;
  }
  if (flow == 'demo') {
    whenReady(function(subscriptions) {
      var controller = new DemoPaywallController(subscriptions);
      controller.start();
    });
    return;
  }
  startFlow(flow);
}


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
    this.subscriptions.reset();
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
      // TODO: Start account creation flow. Restart entitlements.
      log('got subscription response', response);
      this.openPaywall_();
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
    this.start();
  }
}


/** Initiates the flow, if valid */
startFlowAuto();
