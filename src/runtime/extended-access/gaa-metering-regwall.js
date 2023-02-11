/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

import {AnalyticsEvent} from '../../proto/api_messages';
import {
  CASL_HTML,
  GOOGLE_3P_SIGN_IN_BUTTON_HTML,
  GOOGLE_3P_SIGN_IN_BUTTON_ID,
  GOOGLE_3P_SIGN_IN_IFRAME_STYLES,
  GOOGLE_SIGN_IN_BUTTON_STYLES,
  GOOGLE_SIGN_IN_IFRAME_ID,
  PUBLISHER_SIGN_IN_BUTTON_ID,
  REGISTRATION_BUTTON_CONTAINER_ID,
  REGISTRATION_BUTTON_HTML,
  REGISTRATION_WIDGET_IFRAME_HTML,
  REGWALL_CONTAINER_ID,
  REGWALL_DIALOG_ID,
  REGWALL_HTML,
  REGWALL_TITLE_ID,
  SIGN_IN_WITH_GOOGLE_BUTTON_ID,
} from './html-templates';
import {GaaUserDef, GoogleIdentityV1Def, GoogleUserDef} from './typedefs';
import {I18N_STRINGS} from '../../i18n/strings';
import {JwtHelper} from '../../utils/jwt';
import {
  POST_MESSAGE_COMMAND_3P_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_ERROR,
  POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_INTRODUCTION,
  POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK,
  POST_MESSAGE_COMMAND_USER,
  POST_MESSAGE_STAMP,
  REDIRECT_DELAY,
} from './constants';
import {
  QueryStringUtils,
  callSwg,
  configureGoogleSignIn,
  logEvent,
  queryStringHasFreshGaaParams,
} from './utils';
import {ShowcaseEvent} from '../../api/subscriptions';
import {addQueryParam} from '../../utils/url';
import {createElement, injectStyleSheet} from '../../utils/dom';
import {debugLog, warn} from '../../utils/log';
import {getLanguageCodeFromElement, msg} from '../../utils/i18n';
import {parseJson} from '../../utils/json';
import {resolveDoc} from '../../model/doc';
import {setImportantStyles} from '../../utils/style';

export class GaaMeteringRegwall {
  /**
   * Returns a promise for a Google user object.
   * The user object will be a:
   * - GaaUserDef, if you use the GaaGoogleSignInButton
   * - GoogleIdentityV1Def, if you use the GaaSignInWithGoogleButton
   * - Custom object, if you use the GaaGoogle3pSignInButton
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ iframeUrl: string, caslUrl: string }} params
   * @return {!Promise<!GaaUserDef|!GoogleIdentityV1Def|!Object>}
   */
  static async show({iframeUrl, caslUrl}) {
    const queryString = QueryStringUtils.getQueryString();
    if (!queryStringHasFreshGaaParams(queryString)) {
      const errorMessage =
        '[swg-gaa.js:GaaMeteringRegwall.show]: URL needs fresh GAA params.';
      warn(errorMessage);
      return Promise.reject(errorMessage);
    }

    logEvent({
      showcaseEvent: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL,
      isFromUserAction: false,
    });

    GaaMeteringRegwall.render_({iframeUrl, caslUrl});
    GaaMeteringRegwall.sendIntroMessageToGsiIframe_({iframeUrl});
    GaaMeteringRegwall.logButtonClickEvents_();
    try {
      const gaaUser = await GaaMeteringRegwall.getGaaUser_();
      GaaMeteringRegwall.remove();
      return gaaUser;
    } catch (err) {
      // Close the Regwall, since the flow failed.
      GaaMeteringRegwall.remove();

      // Rethrow error.
      throw err;
    }
  }

  /**
   * Returns a promise for a Google user object.
   * The user object will be a GoogleIdentityV1Def
   *
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   * @nocollapse
   * @param {{ caslUrl: string, googleApiClientId: string, rawJwt: (boolean|null) }} params
   * @return {!Promise<!GoogleIdentityV1Def|JsonObject|undefined>}
   */
  static async showWithNativeRegistrationButton({
    caslUrl,
    googleApiClientId,
    rawJwt = true,
  }) {
    logEvent({
      showcaseEvent: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL,
      isFromUserAction: false,
    });

    GaaMeteringRegwall.render_({
      iframeUrl: '',
      caslUrl,
      useNativeMode: true,
    });

    try {
      const jwt = await GaaMeteringRegwall.createNativeRegistrationButton({
        googleApiClientId,
      });
      GaaMeteringRegwall.remove();
      if (rawJwt) {
        return jwt;
      } else {
        return new JwtHelper().decode(jwt.credential);
      }
    } catch (err) {
      // Close the Regwall, since the flow failed.
      GaaMeteringRegwall.remove();

      // Rethrow error.
      debugLog(`Regwall failed: ${err}`);
    }
  }

  /**
   * This method opens a metering regwall dialog,
   * where users can sign in with Google.
   *
   * @nocollapse
   * @param {{ caslUrl: string, authorizationUrl: string }} params
   * @return {boolean}
   */
  static showWithNative3PRegistrationButton({caslUrl, authorizationUrl}) {
    logEvent({
      showcaseEvent: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL,
      isFromUserAction: false,
    });

    GaaMeteringRegwall.render_({
      iframeUrl: '',
      caslUrl,
      useNativeMode: true,
    });
    return GaaMeteringRegwall.createNative3PRegistrationButton({
      authorizationUrl,
    });
  }

  /**
   * Removes the Regwall.
   * @nocollapse
   */
  static remove() {
    const regwallContainer = self.document.getElementById(REGWALL_CONTAINER_ID);
    if (regwallContainer) {
      regwallContainer.remove();
    }
  }

  /**
   * Signs out of Google Sign-In.
   * This is useful for developers who are testing their
   * SwG integrations.
   * @nocollapse
   * @return {!Promise}
   */
  static async signOut() {
    await configureGoogleSignIn();
    await self.gapi.auth2.getAuthInstance().signOut();
  }

  /**
   * Renders the Regwall.
   * @private
   * @nocollapse
   * @param {{ iframeUrl: string, caslUrl: string, useNativeMode: (boolean|undefined)}} params
   */
  static render_({iframeUrl, caslUrl, useNativeMode = false}) {
    const languageCode = getLanguageCodeFromElement(self.document.body);
    const publisherName = GaaMeteringRegwall.getPublisherNameFromPageConfig_();
    const placeholderPatternForPublication = /\$PUBLICATION\$/g;
    const placeholderPatternForLinkStart = /\$LINK_START\$/g;
    const placeholderPatternForLinkEnd = /\$LINK_END\$/g;

    // Create and style container element.
    // TODO: Consider using a FriendlyIframe here, to avoid CSS conflicts.
    const containerEl = createElement(self.document, 'div', {
      id: REGWALL_CONTAINER_ID,
    });
    setImportantStyles(containerEl, {
      'all': 'unset',
      'background-color': 'rgba(32, 33, 36, 0.6)',
      'border': 'none',
      'bottom': '0',
      'height': '100%',
      'left': '0',
      'opacity': '0',
      'pointer-events': 'none',
      'position': 'fixed',
      'right': '0',
      'transition': 'opacity 0.5s',
      'top': '0',
      'width': '100%',
      'z-index': 2147483646,
    });

    // Optionally include CASL HTML.
    let caslHtml = '';
    if (caslUrl) {
      caslHtml = CASL_HTML.replace(
        '$SHOWCASE_REGWALL_CASL$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_CASL'], languageCode)
      )
        // Update link.
        .replace(
          placeholderPatternForLinkStart,
          `<a href="${encodeURI(caslUrl)}" target="_blank">`
        )
        .replace(placeholderPatternForLinkEnd, '</a>')
        // Update publisher name.
        .replace(
          placeholderPatternForPublication,
          `<strong>${publisherName}</strong>`
        );
    }

    let registrationButtonHtml = '';
    if (useNativeMode) {
      registrationButtonHtml = REGISTRATION_BUTTON_HTML;
    } else {
      // Tell the iframe which language to render.
      iframeUrl = addQueryParam(iframeUrl, 'lang', languageCode);
      registrationButtonHtml = REGISTRATION_WIDGET_IFRAME_HTML.replace(
        '$iframeUrl$',
        iframeUrl
      );
    }

    // Prepare HTML.
    containerEl./*OK*/ innerHTML = REGWALL_HTML.replace(
      '$SHOWCASE_REGISTRATION_BUTTON$',
      registrationButtonHtml
    )
      .replace(
        '$SHOWCASE_REGWALL_TITLE$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_TITLE'], languageCode)
      )
      .replace(
        '$SHOWCASE_REGWALL_DESCRIPTION$',
        msg(I18N_STRINGS['SHOWCASE_REGWALL_DESCRIPTION'], languageCode)
          // Update publisher name.
          .replace(placeholderPatternForPublication, publisherName)
      )
      .replace(
        '$SHOWCASE_REGWALL_PUBLISHER_SIGN_IN_BUTTON$',
        msg(
          I18N_STRINGS['SHOWCASE_REGWALL_PUBLISHER_SIGN_IN_BUTTON'],
          languageCode
        )
      )
      .replace('$SHOWCASE_REGWALL_CASL$', caslHtml);

    // Add container to DOM.
    self.document.body.appendChild(containerEl);

    // Trigger a fade-in transition.
    /** @suppress {suspiciousCode} */
    containerEl.offsetHeight; // Trigger a repaint (to prepare the CSS transition).
    setImportantStyles(containerEl, {'opacity': 1});

    // Listen for clicks.
    GaaMeteringRegwall.addClickListenerOnPublisherSignInButton_();

    // Focus on the title after the dialog animates in.
    // This helps people using screenreaders.
    const dialogEl = self.document.getElementById(REGWALL_DIALOG_ID);
    dialogEl.addEventListener('animationend', () => {
      const titleEl = self.document.getElementById(REGWALL_TITLE_ID);
      titleEl.focus();
    });

    return containerEl;
  }

  /**
   * Gets publisher name from page config.
   * @private
   * @nocollapse
   * @return {string}
   */
  static getPublisherNameFromPageConfig_() {
    const jsonLdPageConfig =
      GaaMeteringRegwall.getPublisherNameFromJsonLdPageConfig_();
    if (jsonLdPageConfig) {
      return jsonLdPageConfig;
    }

    const microdataPageConfig =
      GaaMeteringRegwall.getPublisherNameFromMicrodataPageConfig_();
    if (microdataPageConfig) {
      return microdataPageConfig;
    }

    throw new Error(
      'Showcase articles must define a publisher name with either JSON-LD or Microdata.'
    );
  }

  /**
   * Gets publisher name from JSON-LD page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getPublisherNameFromJsonLdPageConfig_() {
    // Get JSON from ld+json scripts.
    const ldJsonScripts = Array.prototype.slice.call(
      self.document.querySelectorAll('script[type="application/ld+json"]')
    );
    const jsonQueue = /** @type {!Array<*>} */ (
      ldJsonScripts.map((script) => parseJson(script.textContent))
    );

    // Search for publisher name, breadth-first.
    for (let i = 0; i < jsonQueue.length; i++) {
      const json = /** @type {!Object<?,?>} */ (jsonQueue[i]);

      // Return publisher name, if possible.
      const publisherName = json?.publisher?.name;
      if (publisherName) {
        return publisherName;
      }

      // Explore JSON.
      if (json && typeof json === 'object') {
        jsonQueue.push(...Object.values(json));
      }
    }
  }

  /**
   * Gets publisher name from Microdata page config.
   * @private
   * @nocollapse
   * @return {string|undefined}
   */
  static getPublisherNameFromMicrodataPageConfig_() {
    const publisherNameElements = self.document.querySelectorAll(
      '[itemscope][itemtype][itemprop="publisher"] [itemprop="name"]'
    );

    for (const publisherNameElement of publisherNameElements) {
      const publisherName = publisherNameElement.content;
      if (publisherName) {
        return publisherName;
      }
    }
  }

  /**
   * Adds a click listener on the publisher sign-in button.
   * @private
   * @nocollapse
   */
  static addClickListenerOnPublisherSignInButton_() {
    self.document
      .getElementById(PUBLISHER_SIGN_IN_BUTTON_ID)
      .addEventListener('click', (e) => {
        e.preventDefault();

        logEvent({
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_EXISTING_ACCOUNT_CLICK,
          isFromUserAction: true,
        });

        callSwg((swg) => swg.triggerLoginRequest({linkRequested: false}));
      });
  }

  /**
   * Returns the GAA user, after the user signs in.
   * @private
   * @nocollapse
   * @return {!Promise<!GoogleUserDef>}
   */
  static getGaaUser_() {
    // Listen for GAA user.
    return new Promise((resolve, reject) => {
      self.addEventListener('message', (e) => {
        if (e.data.stamp === POST_MESSAGE_STAMP) {
          if (e.data.command === POST_MESSAGE_COMMAND_USER) {
            // Pass along user details.
            resolve(e.data.gaaUser || e.data.returnedJwt);
          }

          if (e.data.command === POST_MESSAGE_COMMAND_ERROR) {
            // Reject promise due to Google Sign-In error.
            reject('Google Sign-In could not render');
          }
        }
      });
    });
  }

  /**
   * Logs button click events.
   * @private
   * @nocollapse
   */
  static logButtonClickEvents_() {
    // Listen for button event messages.
    self.addEventListener('message', (e) => {
      if (
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_GSI_BUTTON_CLICK
      ) {
        // Log button click event.
        logEvent({
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_GSI_CLICK,
          isFromUserAction: true,
        });
      }
      if (
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_SIWG_BUTTON_CLICK
      ) {
        // Log button click event.
        logEvent({
          analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_SIWG_CLICK,
          isFromUserAction: true,
        });
      }
      if (
        e.data.stamp === POST_MESSAGE_STAMP &&
        e.data.command === POST_MESSAGE_COMMAND_3P_BUTTON_CLICK
      ) {
        // Log button click event.
        logEvent({
          analyticsEvent:
            AnalyticsEvent.ACTION_SHOWCASE_REGWALL_3P_BUTTON_CLICK,
          isFromUserAction: true,
        });
      }
    });
  }

  /**
   * Sends intro post message to Google Sign-In iframe.
   * @private
   * @nocollapse
   * @param {{ iframeUrl: string }} params
   */
  static sendIntroMessageToGsiIframe_({iframeUrl}) {
    // Introduce this window to the publisher's Google Sign-In iframe.
    // This lets the iframe send post messages back to this window.
    // Without the introduction, the iframe wouldn't have a reference to this window.
    const googleSignInIframe = /** @type {!HTMLIFrameElement} */ (
      self.document.getElementById(GOOGLE_SIGN_IN_IFRAME_ID)
    );
    googleSignInIframe.onload = () => {
      googleSignInIframe.contentWindow.postMessage(
        {
          stamp: POST_MESSAGE_STAMP,
          command: POST_MESSAGE_COMMAND_INTRODUCTION,
        },
        new URL(iframeUrl).origin
      );
    };
  }

  static createNativeRegistrationButton({googleApiClientId}) {
    const languageCode = getLanguageCodeFromElement(self.document.body);
    const parentElement = self.document.getElementById(
      REGISTRATION_BUTTON_CONTAINER_ID
    );
    if (!parentElement) {
      return false;
    }
    // Apply iframe styles.
    const styleText = GOOGLE_SIGN_IN_BUTTON_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
    injectStyleSheet(resolveDoc(self.document), styleText);

    // Create and append button to regwall
    const buttonEl = createElement(self.document, 'div', {
      id: SIGN_IN_WITH_GOOGLE_BUTTON_ID,
      tabIndex: 0,
    });
    parentElement.appendChild(buttonEl);

    function logButtonClicks() {
      logEvent({
        analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_SIWG_CLICK,
        isFromUserAction: true,
      });
    }

    return new Promise((resolve) => {
      self.google.accounts.id.initialize({
        /* eslint-disable google-camelcase/google-camelcase */
        client_id: googleApiClientId,
        callback: resolve,
        /* eslint-enable google-camelcase/google-camelcase */
      });
      self.google.accounts.id.renderButton(buttonEl, {
        'type': 'standard',
        'theme': 'outline',
        'text': 'continue_with',
        'logo_alignment': 'center',
        'click_listener': logButtonClicks,
      });
    });
  }

  static createNative3PRegistrationButton({authorizationUrl}) {
    const languageCode = getLanguageCodeFromElement(self.document.body);
    const parentElement = self.document.getElementById(
      REGISTRATION_BUTTON_CONTAINER_ID
    );
    if (!parentElement) {
      return false;
    }
    // Apply iframe styles.
    const styleText = GOOGLE_3P_SIGN_IN_IFRAME_STYLES.replace(
      '$SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON$',
      msg(I18N_STRINGS['SHOWCASE_REGWALL_GOOGLE_SIGN_IN_BUTTON'], languageCode)
    );
    injectStyleSheet(resolveDoc(self.document), styleText);

    // Render the third party Google Sign-In button.
    const buttonEl = createElement(self.document, 'div', {
      id: GOOGLE_3P_SIGN_IN_BUTTON_ID,
      tabIndex: 0,
    });
    buttonEl./*OK*/ innerHTML = GOOGLE_3P_SIGN_IN_BUTTON_HTML;
    parentElement.appendChild(buttonEl);

    buttonEl.addEventListener('click', () => {
      // Track button clicks.
      logEvent({
        analyticsEvent: AnalyticsEvent.ACTION_SHOWCASE_REGWALL_3P_BUTTON_CLICK,
        isFromUserAction: true,
      });
      // Redirect user using the parent window.
      // TODO(b/242998655): Fix the downstream calls for logEvent to be chained to remove the need of delaying redirect.
      self.setTimeout(() => {
        self.open(authorizationUrl, '_parent');
      }, REDIRECT_DELAY);
    });

    return buttonEl;
  }
}
