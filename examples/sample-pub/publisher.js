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
  const var_args = Array.prototype.slice.call(arguments, 0);
  var_args.unshift('[publisher.js]');
  console.log.apply(console, var_args);
}

log('started');

// Available for testing only. A very bad idea to have a global like this.
let globalSubscriptions;

/**
 * Add subsciptions when ready.
 * @param {function()} callback
 */
function whenReady(callback) {
  (self.SWG = self.SWG || []).push(function (subscriptions) {
    globalSubscriptions = subscriptions;
    callback(subscriptions);
  });
}

// Callbacks.
whenReady(function (subscriptions) {
  function eventCallback(eventName) {
    return function (value) {
      const promise = Promise.resolve(value);
      promise.then(
        function (response) {
          log(eventName, response);
        },
        function (reason) {
          log(eventName + 'failed', reason);
        }
      );
    };
  }
  subscriptions.setOnEntitlementsResponse(eventCallback('entitlements'));
  subscriptions.setOnLinkComplete(eventCallback('link-complete'));
  subscriptions.setOnLoginRequest(eventCallback('login-request'));
  subscriptions.setOnPaymentResponse(subscribeResponse_);
});

/**
 * The subscription has been complete.
 * @param {!Promise<!SubscribeResponse>} promise
 * @private
 */
function subscribeResponse_(promise) {
  promise.then(
    function (response) {
      // TODO: Start account creation flow.
      log('got subscription response', response);
      const toast = document.getElementById('creating_account_toast');
      const userEl = document.getElementById('creating_account_toast_user');
      userEl.textContent = response.userData.email;
      toast.style.display = 'block';
      // TODO: wait for account creation to be complete.
      setTimeout(
        function () {
          response.complete().then(
            function () {
              log('subscription has been confirmed');
              // Open the content.
              this.subscriptions.reset();
              this.start();
            }.bind(this)
          );
          toast.style.display = 'none';
        }.bind(this),
        3000
      );
    }.bind(this),
    function (reason) {
      log('subscription response failed: ', reason);
      throw reason;
    }
  );
}

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
  whenReady(function (subscriptions) {
    const flowFunc = subscriptions[flow];
    const flows = Object.keys(subscriptions);
    if (!(typeof flowFunc == 'function')) {
      throw new Error(
        'Flow "' + flow + '" not found: Available flows: "' + flows + '"'
      );
    }
    log('starting flow', flow, '(', var_args, ')', ' {' + flows + '}');
    const result = flowFunc.apply(subscriptions, var_args);
    Promise.resolve(result).then(function () {
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
  const flow = (window.location.search || '').split('?')[1] || 'demo';
  if (flow == 'none') {
    return;
  }
  if (flow == 'demo') {
    whenReady(function (subscriptions) {
      whenDemoReady(function () {
        const controller = new DemoPaywallController(subscriptions);
        controller.start();
      });
    });
    return;
  }

  if (flow == 'metering') {
    /* eslint-disable */
    const timestamp = 1597686771;

    whenReady((subscriptions) => {
      subscriptions
        .getEntitlements({
          metering: {
            state: {
              // Hashed identifier for a specific user. Please hash this
              // value yourself to avoid sending PII.
              id:
                'user5901e3f7a7fc5767b6acbbbaa927d36f5901e3f7a7fc5767b6acbbbaa927',
              // Standard attributes which affect your meters.
              // Each attribute has a corresponding timestamp, which
              // allows meters to do things like granting access
              // for up to 30 days after a certain action.
              //
              // TODO: Describe which standard attributes are available.
              standardAttributes: {
                registered_user: {
                  timestamp,
                },
              },
              // Custom attributes which affect your meters.
              // Each attribute has a corresponding timestamp, which
              // allows meters to do things like granting access
              // for up to 30 days after a certain action.
              customAttributes: {
                newsletter_subscriber: {
                  timestamp,
                },
              },
            },
          },
        })
        .then((entitlements) => {
          // Check if the article was unlocked with a Google metering entitlement. 
          if (entitlements.enablesThisWithGoogleMetering()) {
            // Consume the entitlement. This lets Google know a specific metering 
            // entitlement was "used up", which allows Google to calculate how many
            // more entitlements a user should be granted for a given meter.
            //
            // Consuming an entitlement will also trigger a dialog that lets the user
            // know Google provided them with a free read.
            entitlements.consume();
          }
        });
    });
    return;
    /* eslint-enable */
  }

  if (flow == 'smartbutton') {
    whenReady(function (subsciptions) {
      const subs = subsciptions;
      whenDemoReady(function () {
        let smartButton = document.querySelector('button#smartButton');
        if (!smartButton) {
          // Create a DOM element for SmartButton demo.
          smartButton = document.createElement('button');
          smartButton.id = 'smartButton';
          const firstParagraph = document.querySelector('.text');
          const container = firstParagraph.parentNode;
          container.insertBefore(smartButton, firstParagraph);
        }

        subs.attachSmartButton(
          smartButton,
          {
            theme: 'light',
            lang: 'en',
            messageTextColor: 'rgba(66, 133, 244, 0.95)',
          },
          function () {
            subs.showOffers({isClosable: true});
          }
        );
      });
    });
    return;
  }

  if (flow == 'button') {
    whenReady(function (subscriptions) {
      whenDemoReady(function () {
        const button1 = subscriptions.createButton(function () {
          log('SwG button clicked!');
        });
        document.body.appendChild(button1);

        const button2 = document.createElement('button');
        document.body.appendChild(button2);
        subscriptions.attachButton(button2, {theme: 'dark'}, function () {
          log('SwG button2 clicked!');
        });

        const button3 = subscriptions.createButton(
          {lang: 'pt-br'},
          function () {
            log('SwG button clicked!');
          }
        );
        document.body.appendChild(button3);

        const button4 = document.createElement('button');
        button4.setAttribute('lang', 'jp');
        document.body.appendChild(button4);
        subscriptions.attachButton(button4, {theme: 'dark'}, function () {
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
    let attempts = 0;
    var interval = setInterval(function () {
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
