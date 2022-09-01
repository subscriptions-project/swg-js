/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {Entitlements as EntitlementsDef} from './entitlements';
import {SubscribeResponse as SubscribeResponseDef} from './subscribe-response';

/* eslint-disable no-unused-vars */
/**
 * Interface for users of the basic tier of Subscribe with Google.
 * @interface
 */
export class BasicSubscriptions {
  /**
   * Initializes the basic subscriptions runtime. This includes setting of the
   * specified param values in the JSON-LD markup of the page, sets up any SwG
   * buttons with attribute 'swg-standard-button', and inserts a SwG prompt for
   * contributions/subscriptions. If the fields specified in the params are
   * already specified in the JSON-LD markup on the page, the existing values
   * will be preserved, and the values within init will be ignored.
   * @param {{
   *   type: (string|!Array<string>),
   *   isAccessibleForFree: boolean,
   *   isPartOfType: (string|!Array<string>),
   *   isPartOfProductId: string,
   *   autoPromptType: (AutoPromptType|undefined),
   *   clientOptions: (ClientOptions|undefined),
   *   alwaysShow: (boolean|undefined),
   *   disableDefaultMeteringHandler: (boolean|undefined),
   *   publisherProvidedId: (string|undefined),
   * }=} params
   */
  init(params) {}

  /**
   * Set the entitlement check callback.
   * @param {function(!Promise<!EntitlementsDef>)} callback
   * @return {?}
   */
  setOnEntitlementsResponse(callback) {}

  /**
   * Set the payment complete callback.
   * @param {function(!Promise<!SubscribeResponseDef>)} callback
   * @return {?}
   */
  setOnPaymentResponse(callback) {}

  /**
   * Open CheckEntitlementsView to let users log in Google and check their entitlements.
   * @param {function(!LoginRequest)} callback
   * @return {?}
   */
  setOnLoginRequest(callback) {}

  /**
   * Creates and displays a SwG subscription or contribution prompt, where the
   * prompt type is determined by the parameters passed in to init. If the auto
   * prompt is determined to have been already set up, the setup portion of the
   * function will be skipped, and the prompt will be displayed. The
   * autoPromptType specifies which type of prompt should be displayed (see
   * AutoPromptType below). The alwaysShow parameter is an option to force show
   * the prompt, regardless of any display rules. This parameter is intended for
   * preview purposes.
   * @param {{
   *   autoPromptType: (!AutoPromptType|undefined),
   *   alwaysShow: (boolean|undefined),
   * }} options
   * @returns {!Promise}
   */
  setupAndShowAutoPrompt(options) {}

  /**
   * Dismisses any SwG UI currently displayed. Intended to be used for preview
   * purposes.
   * @return {?}
   */
  dismissSwgUI() {}
}
/* eslint-enable no-unused-vars */

/**
 * The types of autoprompt that can be specified to be shown. CONTRIBUTION and
 * SUBSCRIPTION will trigger the small, button-like prompt, and
 * CONTRIBUTION_LARGE and SUBSCRIPTION_LARGE will trigger the larger purchase
 * UI.
 * @enum {string}
 */
export const AutoPromptType = {
  NONE: 'none',
  CONTRIBUTION: 'contribution',
  CONTRIBUTION_LARGE: 'contribution_large',
  SUBSCRIPTION: 'subscription',
  SUBSCRIPTION_LARGE: 'subscription_large',
};

/**
 * Options for configuring all client UI.
 * Properties:
 * - disableButton: whether to enable button.
 * - forceLangInIframes: whether to force the specified lang in iframes.
 * - lang: Sets the button and prompt language. Default is "en".
 * - theme: "light" or "dark". Default is "light".
 *
 * @typedef {{
 *   disableButton: (boolean|undefined),
 *   lang: (string|undefined),
 *   forceLangInIframes: (boolean|undefined),
 *   theme: (ClientTheme|undefined),
 *   allowScroll: (boolean|undefined),
 * }}
 */
export let ClientOptions;

/**
 * @typedef {{
 *   linkRequested: boolean,
 * }}
 */
export let LoginRequest;

/** @enum {string} */
export const ClientTheme = {
  LIGHT: 'light',
  DARK: 'dark',
};
