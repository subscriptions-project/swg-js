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
  (self.SWG = self.SWG || []).push(function(subscriptions) {
    globalSubscriptions = subscriptions;
    callback(subscriptions);
  });
}

// Callbacks.
whenReady(function(subscriptions) {
  function eventCallback(eventName) {
    return function(value) {
      var promise = Promise.resolve(value);
      promise.then(function(response) {
        log(eventName, response);
      }, function(reason) {
        log(eventName + 'failed', reason);
      });
    };
  }
  subscriptions.setOnEntitlementsResponse(eventCallback('entitlements'));
  subscriptions.setOnLinkComplete(eventCallback('link-complete'));
  subscriptions.setOnLoginRequest(eventCallback('login-request'));
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
          'Flow "' + flow + '" not found: Available flows: "' + flows + '"');
    }
    log('starting flow', flow, '(', var_args, ')', ' {' + flows + '}');
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
  var flow = (window.location.search || '').split('?')[1] || 'demo';
  if (flow.indexOf('loginPrompt') >= 0) {
    flowArgs = flow.split('&')[1].split('=');
    flowData = {};
    for(i = 0; i < flowArgs.length; i++) {
      flowData[flowArgs[i]] = flowArgs[i+1];
      i++;
    }
    whenReady(function(subscriptions) {
      whenDemoReady(function() {
        var controller = new DemoPaywallController(subscriptions, flowData);
        controller.start();
      });
    });
    return;
  }
  if (flow == 'none') {
    return;
  }
  if (flow == 'demo') {
    whenReady(function(subscriptions) {
      whenDemoReady(function() {
        var controller = new DemoPaywallController(subscriptions);
        controller.start();
      });
    });
    return;
  }
  if (flow == 'button') {
    whenReady(function(subscriptions) {
      whenDemoReady(function() {
        var button1 = subscriptions.createButton(function() {
          log('SwG button clicked!');
        });
        document.body.appendChild(button1);

        var button2 = document.createElement('button');
        document.body.appendChild(button2);
        subscriptions.attachButton(button2, {theme: 'dark'}, function() {
          log('SwG button2 clicked!');
        });

        var button3 = subscriptions.createButton({lang: 'pt-br'}, function() {
          log('SwG button clicked!');
        });
        document.body.appendChild(button3);

        var button4 = document.createElement('button');
        button4.setAttribute('lang', 'jp');
        document.body.appendChild(button4);
        subscriptions.attachButton(button4, {theme: 'dark'}, function() {
          log('SwG button4 clicked!');
        });
      });
    });
    return;
  }
  startFlow(flow);
}


/**
 * @param {function()} callback
 */
function whenDemoReady(callback) {
  if (typeof DemoPaywallController == 'function') {
    callback();
  } else {
    var attempts = 0;
    var interval = setInterval(function() {
      attempts++;
      if (typeof DemoPaywallController == 'function') {
        clearInterval(interval);
        callback();
      } else if (attempts > 100) {
        clearInterval(interval);
        throw new Error('cannot find DemoPaywallController');
      }
    }, 100);
  }
}


/** Initiates the flow, if valid */
startFlowAuto();
