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
  const var_args = Array.prototype.slice.call(arguments, 0);
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
 */
function startFlow() {
  whenReady(function(subscriptions) {
    const flow = window.location.href.split('?')[1];
    if (!flow) {
      return;
    }
    const flowFunc = subscriptions[flow];
    const flows = Object.keys(subscriptions);
    if (!(typeof flowFunc == 'function')) {
      throw new Error(
          `Flow "${flow}" not found: Available flows: "${flows}"`);
    }
    log('starting flow', flow, ` (${flows})`);
    const result = flowFunc.call(subscriptions);
    Promise.resolve(result).then(() => {
      log('flow complete', flow);
    });
  });
}

/** Initiates the flow, if valid */
startFlow();
