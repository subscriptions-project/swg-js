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
    Promise.resolve(result).then(() => {
      log('flow complete', flow);
    });
  });
}

/**
 * Selects the flow based on the URL query parameter.
 * (ex: http://localhost:8000/examples/sample-pub/1?metering)
 * The query parameter is the name of the function defined in runtime.
 * Defaults to 'showOffers'.
 * Current valid values are: 'showOffers', 'linkAccount', 'getEntitlements'.
 */
function startFlowAuto() {
  let flow = (window.location.search || '').split('?')[1] || 'demo';

  // Check for valid Google Article Access (GAA) params.
  if (isGaa()) {
    console.log(
      'Google Article Access (GAA) params triggered the "metering" flow.'
    );
    flow = 'metering';
  }

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

    whenReady((subscriptions) => {
      // Forget any subscriptions, for metering demo purposes.
      subscriptions.clear();

      // Set up metering demo controls.
      MeteringDemo.setupControls();

      // Handle clicks on the Metering Toast's "Subscribe" button.
      subscriptions.setOnNativeSubscribeRequest(() => {
        // Show a publisher paywall for demo purposes.
        startFlow('showOffers');
      });

      // Handle clicks on the "Already have an account?" link within the
      // Metering Regwall dialog.
      subscriptions.setOnLoginRequest(() => {
        subscriptions.linkAccount();
      });

      // Handle users linking their account.
      subscriptions.setOnLinkComplete(() => {
        subscriptions.reset();

        location.reload();
      });

      // Fetch the current user's metering state.
      MeteringDemo.fetchMeteringState()
        .then((meteringState) => {
          if (meteringState.registrationTimestamp) {
            // Skip metering regwall for registered users.
            return meteringState;
          }

          // Show metering regwall for unregistered users.
          return GaaMeteringRegwall.show({
            publisherName: MeteringDemo.PUBLISHER_NAME,
            iframeUrl: MeteringDemo.GOOGLE_SIGN_IN_IFRAME_URL,
          })
            .then((googleUser) =>
              // Register a user based on Google Sign-In's User object.
              // https://developers.google.com/identity/sign-in/web/reference#users
              //
              // We advise setting a 1st party, secure, HTTP-only cookie,
              // so it lives past 7 days in Safari.
              // https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
              MeteringDemo.registerUser(googleUser)
            )
            .then(() =>
              // Fetch the current user's metering state again
              // since they registered.
              MeteringDemo.fetchMeteringState()
            );
        })
        .then((meteringState) => {
          // Get SwG entitlements.
          subscriptions
            .getEntitlements({
              metering: {
                state: {
                  // Hashed identifier for a specific user. Hash this value yourself
                  // to avoid sending PII.
                  id: meteringState.id,
                  // Standard attributes which affect your meters.
                  // Each attribute has a corresponding timestamp, which
                  // allows meters to do things like granting access
                  // for up to 30 days after a certain action.
                  //
                  // TODO: Describe standard attributes, once they're defined.
                  standardAttributes: {
                    registered_user: {
                      timestamp: meteringState.registrationTimestamp,
                    },
                  },
                },
              },
            })
            .then((entitlements) => {
              // Check if an entitlement unlocks the article.
              if (entitlements.enablesThis()) {
                // Check if a Google metering entitlement unlocks the article.
                if (entitlements.enablesThisWithGoogleMetering()) {
                  // Consume the entitlement. This lets Google know a specific free
                  // read was "used up", which allows Google to calculate how many
                  // free reads are left for a given user.
                  //
                  // Consuming an entitlement will also trigger a dialog that lets the user
                  // know Google provided them with a free read.
                  entitlements.consume(() => {
                    // Unlock the article AFTER the user consumes a free read.
                    // Note: If you unlock the article outside of this callback,
                    // users might be able to scroll down and read the article
                    // without closing the dialog, and closing the dialog is
                    // what actually consumes a free read.
                    MeteringDemo.openPaywall();
                  });
                } else {
                  // Unlock article right away, since the user has a subscription.
                  MeteringDemo.openPaywall();
                }
              } else {
                // Show a publisher paywall for demo purposes.
                startFlow('showOffers');
              }
            });
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
        subscriptions.attachButton(button4, {theme: 'dark'}, () => {
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

/**
 * Returns true if the URL contains valid Google Article Access (GAA) params.
 * TODO: Link to a public document describing GAA params.
 * @return {boolean}
 */
function isGaa() {
  // Validate GAA params.
  const params = getQueryParams();
  if (!params.gaa_at) {
    return false;
  }
  if (!params.gaa_n) {
    console.error('SwG Entitlements: The `gaa_n` URL param is missing.');
    return false;
  }
  if (!params.gaa_sig) {
    console.error('SwG Entitlements: The `gaa_sig` URL param is missing.');
    return false;
  }
  if (!params.gaa_ts) {
    console.error('SwG Entitlements: The `gaa_ts` URL param is missing.');
    return false;
  }
  if (parseInt(params.gaa_ts, 16) < Date.now() / 1000) {
    console.error(
      'SwG Entitlements: The `gaa_ts` URL param should contain a hex string timestamp which points to the future.'
    );
    return false;
  }

  // Validate referrer.
  // NOTE: This regex was copied from SwG's AMP extension. https://github.com/ampproject/amphtml/blob/c23bf281f817a2ee5df73f6fd45e9f4b71bb68b6/extensions/amp-subscriptions-google/0.1/amp-subscriptions-google.js#L56
  const GOOGLE_DOMAIN_RE = /(^|\.)google\.(com?|[a-z]{2}|com?\.[a-z]{2}|cat)$/;
  const referrer = getAnchorFromUrl(document.referrer);
  if (
    referrer.protocol !== 'https' ||
    !GOOGLE_DOMAIN_RE.test(referrer.hostname)
  ) {
    // Real publications should bail if this referrer check fails.
    // This script is only logging a warning for metering demo purposes.
    console.warn(
      `SwG Entitlements: This page's referrer ("${referrer.origin}") can't grant Google Article Access. Real publications should bail if this referrer check fails.`
    );
  }

  return true;
}

/**
 * Returns anchor element from a given URL.
 * @return {HTMLAnchorElement}
 */
function getAnchorFromUrl(url) {
  const a = document.createElement('a');
  a.href = url;
  return a.hostname;
}

/**
 * Returns query params from URL.
 * @return {!Object<string, string>}
 */
function getQueryParams() {
  const queryParams = {};
  location.search
    .substring(1)
    .split('&')
    .forEach((pair) => {
      const parts = pair.split('=');
      queryParams[parts[0]] = parts[1];
    });
  return queryParams;
}

/** Initiates the flow, if valid */
startFlowAuto();
