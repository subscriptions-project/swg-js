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

import {ClientTheme} from './subscriptions';
import {Entitlements} from './entitlements';
import {SubscribeResponse} from './subscribe-response';

/**
 * Interface for users of the basic tier of Subscribe with Google.
 */
export interface BasicSubscriptions {
  /**
   * Initializes the basic subscriptions runtime. This includes setting of the
   * specified param values in the JSON-LD markup of the page, sets up any SwG
   * buttons with attribute 'swg-standard-button', and inserts a SwG prompt for
   * contributions/subscriptions. If the fields specified in the params are
   * already specified in the JSON-LD markup on the page, the existing values
   * will be preserved, and the values within init will be ignored.
   */
  init(params: {
    type: string | string[];
    isAccessibleForFree: boolean;
    isPartOfType: string | string[];
    isPartOfProductId: string;
    autoPromptType?: AutoPromptType;
    clientOptions?: ClientOptions;
    alwaysShow?: boolean;
    disableDefaultMeteringHandler?: boolean;
    publisherProvidedId?: string;
  }): void;

  /**
   * Set the entitlement check callback.
   */
  setOnEntitlementsResponse(
    callback: (entitlementsPromise: Promise<Entitlements>) => void
  ): void;

  /**
   * Set the payment complete callback.
   */
  setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): void;

  /**
   * Open CheckEntitlementsView to let users log in Google and check their entitlements.
   */
  setOnLoginRequest(callback: (loginRequest: LoginRequest) => void): void;

  /**
   * Creates and displays a SwG subscription or contribution prompt, where the
   * prompt type is determined by the parameters passed in to init. If the auto
   * prompt is determined to have been already set up, the setup portion of the
   * function will be skipped, and the prompt will be displayed. The
   * autoPromptType specifies which type of prompt should be displayed (see
   * AutoPromptType below). The alwaysShow parameter is an option to force show
   * the prompt, regardless of any display rules. This parameter is intended for
   * preview purposes.
   */
  setupAndShowAutoPrompt(options: {
    autoPromptType?: AutoPromptType;
    alwaysShow?: boolean;
    isAccessibleForFree?: boolean;
  }): Promise<void>;

  /**
   * Dismisses any SwG UI currently displayed. Intended to be used for preview
   * purposes.
   */
  dismissSwgUI(): void;
}

/**
 * The types of autoprompt that can be specified to be shown. CONTRIBUTION and
 * SUBSCRIPTION will trigger the small, button-like prompt, and
 * CONTRIBUTION_LARGE and SUBSCRIPTION_LARGE will trigger the larger purchase
 * UI.
 */
export enum AutoPromptType {
  NONE = 'none',
  CONTRIBUTION = 'contribution',
  CONTRIBUTION_LARGE = 'contribution_large',
  SUBSCRIPTION = 'subscription',
  SUBSCRIPTION_LARGE = 'subscription_large',
}

/**
 * The types of supported publication content type. Should be maintained with:
 * google3/java/com/google/subscribewithgoogle/audienceactions/proto/audience_member_flow_service.proto.
 */
export enum ContentType {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

/**
 * Options for configuring all client UI.
 */
export interface ClientOptions {
  /** Whether to enable button. */
  disableButton?: boolean;
  /** Sets the button and prompt language. Default is "en". */
  lang?: string;
  /** Whether to force the specified lang in iframes. */
  forceLangInIframes?: boolean;
  /** "Light" or "dark". Default is "light". */
  theme?: ClientTheme;
  /** Whether to allow scrolling. */
  allowScroll?: boolean;
  /** Skip account creation screen if requested. */
  skipAccountCreationScreen?: boolean;
}

export interface LoginRequest {
  linkRequested: boolean;
}
