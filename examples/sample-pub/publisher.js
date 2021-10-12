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
  let flow = (location.search || '').split('?')[1] || 'demo';

  // Provide a shortcut to metering params.
  const urlParams = new URLSearchParams(location.search);
  if (urlParams.has('metering')) {
    let newSearch = 'gaa_at=g&gaa_ts=99999999&gaa_n=n0nc3&gaa_sig=51g';
    // Include 3p sign in param if specified.
    if (urlParams.get('use3pSignIn') === 'true') {
      newSearch += '&use3pSignIn=true';
    }
    else if (urlParams.get('useGIS') === 'true') {
      newSearch += '&useGIS=true';
    }
    location.search = newSearch;
    return;
  }

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

      // Set up language.
      MeteringDemo.setupLanguage();

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

      // Fetch entitlements.
      subscriptions.getEntitlements().then((entitlements) => {
        if (entitlements.enablesThis()) {
          // Unlock article right away, since the user has a subscription.
          MeteringDemo.openPaywall();
        } else {
          // Attempt to unlock article with metering.
          maybeUnlockWithMetering();
        }
      });

      function maybeUnlockWithMetering() {
        // Fetch the current user's metering state.
        MeteringDemo.fetchMeteringState()
          .then((meteringState) => {
            if (meteringState.registrationTimestamp) {
              // Skip metering regwall for registered users.
              return meteringState;
            }
          
            const use3pSignIn = getQueryParams().use3pSignIn === 'true';
            const useGIS = getQueryParams().useGIS === 'true';
            let iframeUrl;
            // Specify a URL that renders a sign-in button.
            if (use3pSignIn) {
              iframeUrl = MeteringDemo.GOOGLE_3P_SIGN_IN_IFRAME_URL;
            }
            else if (useGIS) {
              iframeUrl = MeteringDemo.SIGN_IN_WITH_GOOGLE_IFRAME_URL;
            }
            else {
              iframeUrl = MeteringDemo.GOOGLE_SIGN_IN_IFRAME_URL;
            }
            const regwallParams = {
              iframeUrl: iframeUrl,
            };

            // Optionally add a CASL link, for demo purposes.
            const demoCaslUrl = new URLSearchParams(location.search).get(
              'casl_url'
            );
            if (demoCaslUrl) {
              regwallParams.caslUrl = demoCaslUrl;
            }

            // Show metering regwall for unregistered users.
            return GaaMeteringRegwall.show(regwallParams)
              .then((googleSignInUser) =>
                // Register a user based on data from Google Sign-In.
                //
                // We advise setting a 1st party, secure, HTTP-only cookie,
                // so it lives past 7 days in Safari.
                // https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
                MeteringDemo.registerUser(googleSignInUser)
              )
              .then(() =>
                // Fetch the current user's metering state again
                // since they registered.
                MeteringDemo.fetchMeteringState()
              );
          })
          .then((meteringState) => {
            // Forget previous entitlements fetches.
            subscriptions.clear();

            // Get SwG entitlements.
            return subscriptions.getEntitlements({
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
            });
          })
          .catch((err) => {
            console.error(err);
            return false;
          })
          .then((entitlements) => {
            // Check if a Google metering entitlement unlocks the article.
            if (entitlements && entitlements.enablesThisWithGoogleMetering()) {
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
              // Handle failures to unlock the article with metering entitlements.
              // Perhaps the user ran out of free reads. Or perhaps the user
              // dismissed the Regwall. Either way, the publisher determines
              // what happens next. This demo shows offers.
              startFlow('showOffers');
            }
          });
      }
    });

    return;
    /* eslint-enable */
  }

  if (flow == 'consumeShowcaseEntitlementFromServer') {
    whenReady((subscriptions) => {
      // This represents a Showcase entitlement from the publisher's server.
      // You can imagine the publisher's server fetched it and is now rendering JS to consume it.
      const showcaseEntitlementJwt =
        'eyJhbGciOiJSUzI1NiIsImtpZCI6IjNkZDI5ZGIxNGMxYjZjZDhhNGU4ODJlNjk5OTM5MDdhMjhjYzdjMTEiLCJ0eXAiOiJKV1QifQ.eyJlbnRpdGxlbWVudHMiOlt7InNvdXJjZSI6Imdvb2dsZTptZXRlcmluZyIsInN1YnNjcmlwdGlvblRva2VuIjoiZXlKaGJHY2lPaUpTVXpJMU5pSXNJbXRwWkNJNklqTmtaREk1WkdJeE5HTXhZalpqWkRoaE5HVTRPREpsTmprNU9UTTVNRGRoTWpoall6ZGpNVEVpTENKMGVYQWlPaUpLVjFRaWZRLmV5SnRaWFJsY21sdVp5STZleUpwWkNJNklqSTBZakkyTTJRMExXVmtNVGN0TkRWaE15MWhPVFV4TFRRd09USTFabVE1TkRGbFlTSXNJbTkzYm1WeVNXUWlPaUp6WTJWdWFXTXRNakF4Tnk1aGNIQnpjRzkwTG1OdmJTSXNJbkJ5YVc5eWFYUjVJam94TENKaFkzUnBiMjRpT2lKU1JVRkVJaXdpWTJ4cFpXNTBWSGx3WlNJNk1Td2lZMnhwWlc1MFZYTmxja0YwZEhKcFluVjBaU0k2SW5OMFlXNWtZWEprWDNKbFoybHpkR1Z5WldSZmRYTmxjaUlzSW5CMVlteHBjMmhsY2xWelpYSkpaQ0k2SW5Cd2FXUTFORGcwT0RZeE1qZzJPVFkzTkRrM0lpd2lhR0Z6YUdWa1VtVnpiM1Z5WTJWVmNtd2lPaUl3TVdRek56azVOVGd4WTJVM1pHTTJaamRoWVRRM09HSXhNekZtT0dFek5UZzJPV1F4WW1RMlptWTFZVFptWkRZek56azRPR0poWlRKaVpqWmtOak16WW1Wak16Y3dZbUpoWXpFMU5HTTNOV1F6WWpZeFpHVTJOV1ZrTVdRd1pERmtOR0V6T0dKbVlUQXhNekJrTkRrMU5UVXdZekE1TnpobFpUTmxPREE1T0NJc0luTm9iM2RVYjJGemRDSTZkSEoxWlgxOS5kYTVEU3VNb3lCcEQwM0hGcDNhM0RqUWE4M1J2VWRuQkNrUEdyRG5wd1ZqZWdRWDhZbksyWVhaeFZibEhtTUxIYmFSN3hqTFNDeEZRUUh0WW80NjJPYnNZeFRsdFQ0cWVPclQzbFBaSl9nSndDdU9YY1MwSEpzT3JPYXZubXpBMG1pcGxJVEpsV19CZEx4dEhHdm91cTB0Xy1hZkVUZXJVc3RVWk9uX1RRUlcyNE15cmVBOFk5N2l6MlpqNTFFSlZmdUFIODFfeEtyX05FbzNLQXUzdTYzOWZ1UzVwakNGRjRyb1dBbUtNY202eG8yQUswc25sWllPZFZzeHFYWkNBR2JVazBPQ1ZVcF9xZHdUcmd3eVBWbG9NeDdhT2hReXNWYnk0RFROT3JNeWFQU1RpcmhQLUxCTFhvdmNjbHdlU1pmSk5hNEtYSWRCSWV2dnNxQUhnOHciLCJwcm9kdWN0cyI6WyJzY2VuaWMtMjAxNy5hcHBzcG90LmNvbToqIl19XSwiZXhwIjoxNjExMTY4NTgzLCJpYXQiOjE2MTExNjY3ODMsImlzcyI6InN1YnNjcmliZXdpdGhnb29nbGVAc3lzdGVtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJhdWQiOiJodHRwOi8vbG9jYWxob3N0OjgwMDAifQ.NNQrJ4nWs5ZNaY1-g3v4TZfQuMK7MCDJJpJVrrrU7LmZCaav5T6ZJ34ZgO6lKmdixWFwLMNpWrN_dz7JiwfjPN7rpivDL92BOBdVe4TzmPrWVwHYEHtAHJaoF900WveP1h6z-2LGqyHRfIFKootB5_QoSaFiYZthLISaJNZ1HTZtyNZmaivR51cATzd8RB9P5JOy8NsYbEoIDUMKeYFdDaGfiRXyB7oq3pe18LJ-6cskZStWbXSPX_sRL6e7LgViPeieRfF9MeebyhXlRkSV2D9sPfWRJLy5o3kQZxm1gairRBzSU9YzhHSvESY2P0KNW39CXqY6oQLT_5Ac_JpWkw';

      // Consume the Showcase entitlement.
      subscriptions.consumeShowcaseEntitlementJwt(
        showcaseEntitlementJwt,
        () => {
          MeteringDemo.openPaywall();
        }
      );
    });
    return;
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
    referrer.protocol !== 'https:' ||
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
  return a;
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
