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

import {AvailableIntervention} from './available-intervention';
import {ClientEventManagerApi} from './client-event-manager-api';
import {
  DeferredAccountCreationRequest,
  DeferredAccountCreationResponse,
} from './deferred-account-creation';
import {Entitlements} from './entitlements';
import {LoggerApi} from './logger-api';
import {Offer} from './offer';
import {PropensityApi} from './propensity-api';
import {SubscribeResponse} from './subscribe-response';

export interface Subscriptions {
  /**
   * Optionally initializes the subscriptions runtime with publication or
   * product ID. If not called, the runtime will look for the initialization
   * parameters in the page's markup.
   */
  init(productOrPublicationId: string): void;

  /**
   * Optionally configures the runtime with non-default properties. See
   * `Config` definition for details.
   */
  configure(config: Config): Promise<void> | void;

  /**
   * Starts the entitlement flow.
   */
  start(): Promise<void> | void;

  /**
   * Resets the entitlements that can be fetched again.
   */
  reset(): Promise<void> | void;

  /**
   * Resets the entitlements and clears all of the caches.
   */
  clear(): Promise<void> | void;

  getEntitlements(
    params?: GetEntitlementsParamsExternalDef
  ): Promise<Entitlements>;

  /**
   * Set the subscribe callback.
   */
  setOnEntitlementsResponse(
    callback: (entitlements: Promise<Entitlements>) => void
  ): Promise<void> | void;

  /**
   * Returns a set of offers.
   */
  getOffers(options?: {productId?: string}): Promise<Offer[]>;

  /**
   * Starts the Offers flow.
   */
  showOffers(options?: OffersRequest): Promise<void>;

  /**
   * Starts the Offers flow for a subscription update.
   */
  showUpdateOffers(options?: OffersRequest): Promise<void>;

  /**
   * Show subscription option.
   */
  showSubscribeOption(options?: OffersRequest): Promise<void>;

  /**
   * Show abbreviated offers.
   */
  showAbbrvOffer(options?: OffersRequest): Promise<void>;

  /**
   * Show contribution options for the users to select from.
   * The options are grouped together by periods (Weekly, Monthly, etc.).
   * User can select the amount to contribute to from available options
   * to the publisher. These options are based on the SKUs defined in the Play
   * console for a given publication.
   * Each SKU has Amount, Period, SKUId and other attributes.
   */
  showContributionOptions(options?: OffersRequest): Promise<void>;

  /**
   * Set the callback for the native subscribe request. Setting this callback
   * triggers the "native" option in the offers flow.
   */
  setOnNativeSubscribeRequest(callback: () => void): Promise<void> | void;

  /**
   * Set the subscribe complete callback.
   */
  setOnSubscribeResponse(
    callback: (subscribeResponse: Promise<SubscribeResponse>) => void
  ): Promise<void> | void;

  /**
   * Starts subscription purchase flow.
   */
  subscribe(sku: string): Promise<void>;

  /**
   * Starts subscription purchase flow.
   */
  updateSubscription(subscriptionRequest: SubscriptionRequest): Promise<void>;

  /**
   * Set the contribution complete callback.
   */
  setOnContributionResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): Promise<void> | void;

  /**
   * Set the payment complete callback.
   */
  setOnPaymentResponse(
    callback: (subscribeResponsePromise: Promise<SubscribeResponse>) => void
  ): Promise<void> | void;

  /**
   * Starts contributions purchase flow.
   */
  contribute(
    skuOrSubscriptionRequest: string | SubscriptionRequest
  ): Promise<void>;

  /**
   * Starts the deferred account creation flow.
   * See `DeferredAccountCreationRequest` for more details.
   */
  completeDeferredAccountCreation(
    options?: DeferredAccountCreationRequest | null
  ): Promise<DeferredAccountCreationResponse>;

  setOnLoginRequest(
    callback: (loginRequest: LoginRequest) => void
  ): Promise<void> | void;

  triggerLoginRequest(request: LoginRequest): Promise<void> | void;

  /**
   * Starts the login prompt flow.
   */
  showLoginPrompt(): Promise<void>;

  /**
   * Starts the login notification flow.
   */
  showLoginNotification(): Promise<void>;

  setOnLinkComplete(callback: () => void): Promise<void> | void;

  waitForSubscriptionLookup(accountPromise: Promise<unknown>): Promise<unknown>;

  /**
   * Starts the Account linking flow.
   * TODO(dparikh): decide if it's only exposed for testing or PROD purposes.
   */
  linkAccount(params?: {ampReaderId?: string}): Promise<void>;

  /**
   * Notifies the client that a flow has been started. The name of the flow
   * is passed as the callback argument. The flow name corresponds to the
   * method name in this interface, such as "showOffers", or "subscribe".
   * See `SubscriptionFlows` for the full list.
   *
   * Also see `setOnFlowCanceled` method.
   */
  setOnFlowStarted(
    callback: (params: {flow: string; data: object}) => void
  ): Promise<void> | void;

  /**
   * Notifies the client that a flow has been canceled. The name of the flow
   * is passed as the callback argument. The flow name corresponds to the
   * method name in this interface, such as "showOffers", or "subscribe".
   * See `SubscriptionFlows` for the full list.
   *
   * Notice that some of the flows, such as "subscribe", could additionally
   * have their own "cancel" events.
   *
   * Also see `setOnFlowStarted` method.
   */
  setOnFlowCanceled(
    callback: (params: {flow: string; data: object}) => void
  ): Promise<void> | void;

  /**
   * Starts the save subscriptions flow.
   * @return a promise indicating whether the flow completed successfully.
   */
  saveSubscription(
    requestCallback: SaveSubscriptionRequestCallback
  ): Promise<boolean>;

  /**
   * Starts the subscription linking flow.
   * @return promise indicating result of the operation
   */
  linkSubscription(
    linkSubscriptionRequest: LinkSubscriptionRequest
  ): Promise<LinkSubscriptionResult>;

  /**
   * Creates an element with the SwG button style and the provided callback.
   * The default theme is "light".
   */
  createButton(
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): Element;

  /**
   * Attaches the SwG button style and the provided callback to an existing
   * DOM element. The default theme is "light".
   */
  attachButton(
    button: HTMLElement,
    optionsOrCallback: ButtonOptions | (() => void),
    callback?: () => void
  ): void;

  /**
   * Attaches smartButton element and the provided callback.
   * The default theme is "light".
   */
  attachSmartButton(
    button: HTMLElement,
    optionsOrCallback: SmartButtonOptions | (() => void),
    callback?: () => void
  ): void;

  /**
   * Retrieves the propensity module that provides APIs to
   * get propensity scores based on user state and events
   */
  getPropensityModule(): Promise<PropensityApi>;

  getLogger(): Promise<LoggerApi>;

  getEventManager(): Promise<ClientEventManagerApi>;

  /**
   * Publishers participating in Showcase should call this with their own entitlements
   * and entitlement related UI events.  SwG will automatically do this for Google
   * sourced subscriptions and meters.
   */
  setShowcaseEntitlement(entitlement: PublisherEntitlement): Promise<void>;

  /**
   * Publishers, who both (1) participate in Showcase and (2) use server-side paywalls,
   * should call this method to consume Showcase entitlements.
   */
  consumeShowcaseEntitlementJwt(
    showcaseEntitlementJwt: string,
    onCloseDialog?: () => void | null
  ): Promise<void> | void;

  /**
   * Intelligently returns the most interesting action to the
   * reader based on different different user status. For
   * instance, a new user may get free metering by simply
   * clicking 'follow-publisher' action, and a frequently
   * visiting user may be shown a 'creating an account' action.
   * TODO(moonbong): Implement this function.
   */
  showBestAudienceAction(): void;

  /**
   * Sets the publisherProvidedId.
   */
  setPublisherProvidedId(publisherProvidedId: string): Promise<void> | void;

  /**
   * Returns a list of available interventions. If there are no interventions available
   * an empty array is returned. If the article does not exist, null is returned.
   */
  getAvailableInterventions(): Promise<AvailableIntervention[] | null>;
}

export enum ShowcaseEvent {
  // Events indicating content could potentially be unlocked:

  /** This event is only required if the user can choose not to use a publisher meter. */
  EVENT_SHOWCASE_METER_OFFERED = 'EVENT_SHOWCASE_METER_OFFERED',

  // Events indicating content was unlocked:

  /** Publisher managed subscriptions only. */
  EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION = 'EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION',
  /** Publisher managed meters only. */
  EVENT_SHOWCASE_UNLOCKED_BY_METER = 'EVENT_SHOWCASE_UNLOCKED_BY_METER',
  /** When the article is free for any reason (lead article, etc). */
  EVENT_SHOWCASE_UNLOCKED_FREE_PAGE = 'EVENT_SHOWCASE_UNLOCKED_FREE_PAGE',

  // Events indicating the user must take action to view content:

  /** When the user must register (or log in) to view the article. */
  EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL = 'EVENT_SHOWCASE_NO_ENTITLEMENTS_REGWALL',

  // Events indicating the user must subscribe to view content:

  /** When the user is not eligible for showcase entitlements. */
  EVENT_SHOWCASE_INELIGIBLE_PAYWALL = 'EVENT_SHOWCASE_INELIGIBLE_PAYWALL',
  /** When the user has no remaining showcase entitlements. */
  EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL = 'EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL',
}

/**
 * In order to participate in News Showcase, publishers must report information about their entitlements.
 */
export interface PublisherEntitlement {
  /** Is the user registered currently? */
  isUserRegistered: boolean;
  /** Publisher entitlement event type. */
  entitlement: ShowcaseEvent;
  /** Timestamp(in millisecond) when the user converted to a subscriber. Null if the user is not a subscriber. */
  subscriptionTimestamp: number | null;
}

export enum SubscriptionFlows {
  SHOW_OFFERS = 'showOffers',
  SHOW_SUBSCRIBE_OPTION = 'showSubscribeOption',
  SHOW_ABBRV_OFFER = 'showAbbrvOffer',
  SHOW_CONTRIBUTION_OPTIONS = 'showContributionOptions',
  SUBSCRIBE = 'subscribe',
  CONTRIBUTE = 'contribute',
  COMPLETE_DEFERRED_ACCOUNT_CREATION = 'completeDeferredAccountCreation',
  LINK_ACCOUNT = 'linkAccount',
  SHOW_LOGIN_PROMPT = 'showLoginPrompt',
  SHOW_LOGIN_NOTIFICATION = 'showLoginNotification',
  SHOW_METER_TOAST = 'showMeterToast',
}

export interface Config {
  experiments?: string[];
  /**
   * Either "auto" or "redirect". The "redirect" value will
   * force redirect flow for any window.open operation, including payments.
   * The "auto" value either uses a redirect or a popup flow depending on
   * what's possible on a specific environment. Defaults to "auto".
   */
  windowOpenMode?: WindowOpenMode;
  analyticsMode?: AnalyticsMode;
  /**
   * If set to true then events logged by the publisher's
   * client will be sent to Google's SwG analytics service.  This information is
   * used to compare the effectiveness of Google's buy-flow events to those
   * generated by the publisher's client code.  This includes events sent to
   * both PropensityApi and LoggerApi.
   */
  enableSwgAnalytics?: boolean;
  /**
   * If true events from the logger api are sent to the
   * propensity server.  Note events from the legacy propensity endpoint are
   * always sent.
   */
  enablePropensity?: boolean;
  publisherProvidedId?: string;
  paySwgVersion?: string;
}

/**
 * Params for GetEntitlements requests to SwG Client.
 * swg-js constructs objects of this type, but publisher JS won't.
 * swg-js converts these params to a Base64 JSON string
 * before sending them to SwG Client.
 */
export interface GetEntitlementsParamsInternalDef {
  metering?: GetEntitlementsMeteringParamsInternal;
}

/**
 * Encryption params for GetEntitlements requests.
 */
export interface GetEntitlementsEncryptionParams {
  encryptedDocumentKey: string;
}

/**
 * Metering params for GetEntitlements requests to SwG Client.
 * swg-js constructs objects of this type, but publisher JS won't.
 */
export interface GetEntitlementsMeteringParamsInternal {
  clientTypes?: number[];
  owner?: string;
  state?: {
    id: string;
    attributes: {
      name: string;
      timestamp: number;
    }[];
  };
  token?: string;
  resource: {
    hashedCanonicalUrl: string;
  };
}

/**
 * Params for `getEntitlements` calls from publisher JS.
 * swg-js converts objects of this type to GetEntitlementsParamsInternal.
 */
export interface GetEntitlementsParamsExternalDef {
  encryption?: GetEntitlementsEncryptionParams;
  metering?: GetEntitlementsMeteringParamsExternal;
  publisherProvidedId?: string;
}

/**
 * Params for `getEntitlements` calls from publisher JS.
 * swg-js converts objects of this type to GetEntitlementsMeteringParamsInternal.
 */
export interface GetEntitlementsMeteringParamsExternal {
  clientTypes?: number[];
  owner?: string;
  state: {
    id: string;
    standardAttributes: {
      [key: string]: {
        timestamp: number;
      };
    };
    customAttributes?: {
      [key: string]: {
        timestamp: number;
      };
    };
  };
  resource?: {
    hashedCanonicalUrl: string;
  };
}

export enum AnalyticsMode {
  DEFAULT = 0,
  IMPRESSIONS = 1,
}

export enum WindowOpenMode {
  AUTO = 'auto',
  REDIRECT = 'redirect',
}

export enum ReplaceSkuProrationMode {
  /**
   * The replacement takes effect immediately, and the remaining time will
   * be prorated and credited to the user. This is the current default
   * behavior.
   */
  IMMEDIATE_WITH_TIME_PRORATION = 'IMMEDIATE_WITH_TIME_PRORATION',
}

/**
 * The Offers/Contributions UI is rendered differently based on the
 * ProductType. The ProductType parameter is passed to the Payments flow, and
 * then passed back to the Payments confirmation page to render messages/text
 * based on the ProductType.
 */
export enum ProductType {
  SUBSCRIPTION = 'SUBSCRIPTION',
  UI_CONTRIBUTION = 'UI_CONTRIBUTION',
}

export enum ClientTheme {
  LIGHT = 'light',
  DARK = 'dark',
}

export function defaultConfig(): Config {
  return {
    windowOpenMode: WindowOpenMode.AUTO,
    analyticsMode: AnalyticsMode.DEFAULT,
    enableSwgAnalytics: false,
    enablePropensity: false,
  };
}

export interface OffersRequest {
  /**
   * A list of SKUs to return from the defined or default list. The
   * order is preserved. Required if oldSku is specified (to indicate which
   * SKUs the user can upgrade or downgrade to).
   */
  skus?: string[];

  /**
   * A predefined list of SKUs. Use of this property is uncommon.
   * Possible values are "default" and "amp". Default is "default".
   */
  list?: string;

  /** A boolean value to determine whether the view is closable. */
  isClosable?: boolean;

  /**
   * Optional. The SKU to replace. For example, if a user wants to
   * upgrade or downgrade their current subscription.
   */
  oldSku?: string;

  /**
   * Optional. Disables the fade in animation if set to false. Defaults to true
   * if unset.
   * TODO: b/304803271 - remove this field from the api.
   */
  shouldAnimateFade?: boolean;
}

export interface LoginRequest {
  linkRequested: boolean;
}

/**
 * Properties:
 * - one and only one of "token" or "authCode"
 * AuthCode reference: https://developers.google.com/actions/identity/oauth2-code-flow
 * Token reference: https://developers.google.com/actions/identity/oauth2-implicit-flow
 */
export interface SaveSubscriptionRequest {
  token?: string;
  authCode?: string;
}

/**
 * Callback for retrieving subscription request
 */
export type SaveSubscriptionRequestCallback = () =>
  | Promise<SaveSubscriptionRequest>
  | SaveSubscriptionRequest;

export interface ButtonOptions {
  /** Sets the button SVG and title. Default is "en". */
  theme?: string;
  /** "Light" or "dark". Default is "light". */
  lang?: string;
  /** Whether to enable the button. */
  enable?: boolean;
}

export interface SmartButtonOptions {
  /** Sets the button SVG and title. Default is "en". */
  theme?: string;
  /** "Light" or "dark". Default is "light". */
  lang?: string;
  /** Overrides theme color for message text. (ex: "#09f") */
  messageTextColor?: string;
}

export interface SubscriptionRequest {
  /** Required. Sku to add to the user's subscriptions. */
  skuId: string;
  /**
   * Optional. This is if you want to replace one sku with another. For
   * example, if a user wants to upgrade or downgrade their current subscription.
   */
  oldSku?: string;
  /**
   * Optional. When replacing a subscription you can decide on a
   * specific proration mode to charge the user.
   * The default is IMMEDIATE_WITH_TIME_PRORATION.
   */
  replaceSkuProrationMode?: ReplaceSkuProrationMode;
  /**
   * Optional. When a user chooses a contribution, they have the option
   * to make it non-recurring.
   */
  oneTime?: boolean;
  /**
   * Optional. Extra data relating to the request.
   */
  metadata?: object;
}

export interface LinkSubscriptionRequest {
  publisherProvidedId: string;
}

export interface LinkSubscriptionResult {
  publisherProvidedId?: string | null;
  success: boolean;
}
