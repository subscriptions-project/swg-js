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

// PLEASE DO NOT HOST THIS FILE YOURSELF. DOING SO WILL BREAK THINGS.
//
// Publishers should load this file from:
// https://news.google.com/swg/js/v1/swg-gaa.js
//
// Thanks!

import {AnalyticsEvent} from '../../proto/api_messages';
import {Entitlements} from '../../api/entitlements';
import {GaaMeteringRegwall} from './gaa-metering-regwall';
import {
  GetEntitlementsParamsExternalDef,
  ShowcaseEvent,
} from '../../api/subscriptions';
import {GoogleIdentityV1Def, InitParamsDef, UserState} from './interfaces';
import {GrantReasonType, PaywallReasonType, PaywallType} from './constants';
import {
  QueryStringUtils,
  callSwg,
  logEvent,
  queryStringHasFreshGaaParams,
} from './utils';
import {convertPotentialTimestampToSeconds} from '../../utils/date-utils';
import {debugLog} from '../../utils/log';
import {parseUrl, wasReferredByGoogle} from '../../utils/url';

export class GaaMetering {
  static userState: UserState;
  static publisherEntitlementPromise: Promise<UserState> | null;

  private static gaaUserPromiseResolve_: (
    gaaUser: GoogleIdentityV1Def | {credential: string}
  ) => void;
  private static loginPromiseResolve_: () => void;

  /**
   * Returns a promise that resolves with a gaaUser.
   */
  static getGaaUserPromise(): Promise<
    GoogleIdentityV1Def | {credential: string}
  > {
    return new Promise((resolve) => {
      GaaMetering.gaaUserPromiseResolve_ = resolve;
    });
  }

  static setGaaUser(jwt: GoogleIdentityV1Def | {credential: string}): void {
    GaaMetering.gaaUserPromiseResolve_(jwt);
  }

  /**
   * Returns a promise that resolves when the user clicks "Already registered? Sign in".
   */
  static getLoginPromise(): Promise<void> {
    return new Promise((resolve) => {
      GaaMetering.loginPromiseResolve_ = resolve;
    });
  }

  static resolveLogin() {
    GaaMetering.loginPromiseResolve_();
  }

  /**
   * Initialize GaaMetering flow
   */
  static init(params: InitParamsDef): boolean {
    // Validate GaaMetering parameters
    if (!params || !GaaMetering.validateParameters(params)) {
      debugLog('[gaa.js:GaaMetering.init]: Invalid params.');
      return false;
    }

    // Register publisher's callbacks, promises, and parameters
    const productId = GaaMetering.getProductIDFromPageConfig_();
    const {
      googleApiClientId,
      authorizationUrl,
      allowedReferrers,
      showcaseEntitlement,
      caslUrl,
      showPaywall,
      userState,
      handleSwGEntitlement,
      registerUserPromise,
      handleLoginPromise,
      publisherEntitlementPromise,
      rawJwt,
    } = params;

    // Set class variables
    GaaMetering.userState = userState;
    GaaMetering.publisherEntitlementPromise = publisherEntitlementPromise;

    // Validate gaa parameters and referrer
    if (!GaaMetering.isGaa(allowedReferrers)) {
      debugLog('Extended Access - Invalid gaa parameters or referrer.');
      return false;
    }

    // Make unlockArticle optional when showcaseEntilement is provided.
    const unlockArticle =
      showcaseEntitlement && !params.unlockArticle
        ? () => {}
        : params.unlockArticle;

    // Provide an option to bypass SwG init for 3P integrations.
    const shouldInitializeSwG = params.shouldInitializeSwG ?? true;

    const paywallType = GaaMetering.determinePaywallType(params);

    callSwg(async (subscriptions) => {
      if (shouldInitializeSwG) {
        subscriptions.init(productId);
      }

      logEvent({
        analyticsEvent: AnalyticsEvent.EVENT_SHOWCASE_METERING_INIT,
        isFromUserAction: false,
      });

      subscriptions.setOnLoginRequest(() =>
        GaaMetering.handleLoginRequest(
          handleLoginPromise,
          unlockArticleIfGranted
        )
      );

      subscriptions.setOnNativeSubscribeRequest(() => showPaywall());

      if ('granted' in userState && 'grantReason' in userState) {
        unlockArticleIfGranted();
      } else if (GaaMetering.isArticleFreeFromPageConfig_()) {
        GaaMetering.userState.grantReason = GrantReasonType.FREE;
        GaaMetering.userState.granted = true;
        debugLog('Article free from markup.');
        unlockArticleIfGranted();
      } else if (paywallType == PaywallType.SERVER_SIDE) {
        // For server-side paywall, publisher checks both their own and Google entitlements from their server.
        // If a user has access from publisher, publisher sets userState.granted to true and provides grantReason.
        // If a user has access from Google, publisher sets showcaseEntitlement.
        // Otherwise, publisher ensures paywallType is set to SERVER_SIDE to avoid repeated entitlement checks
        // on the client-side.
        runServerSidePaywallFlow(showcaseEntitlement);
      } else {
        // For client-side paywall, GAA checks publisher entitlement through publisherEntitlementPromise (which
        // returns an updated userState) and Google entitlement through swg.js.
        runClientSidePaywallFlow();
      }
    });

    function runServerSidePaywallFlow(showcaseEntitlement?: string): void {
      if (showcaseEntitlement) {
        debugLog(showcaseEntitlement);
        callSwg((subscriptions) => {
          subscriptions.consumeShowcaseEntitlementJwt(
            showcaseEntitlement,
            () => {
              // Consume the entitlement and trigger a dialog that lets the user
              // know Google provided them with a free read.
              unlockArticle();
            }
          );
        });
      } else if (!GaaMetering.isCurrentUserRegistered()) {
        showGoogleRegwall();
      } else {
        GaaMetering.setEntitlementsForNoAccessUser_();
        debugLog(
          'User is not granted in userState and no showcaseEntitlement provided. Publisher renders a paywall.'
        );
      }
    }

    async function runClientSidePaywallFlow() {
      debugLog('resolving publisherEntitlement');
      const fetchedPublisherEntitlements = await publisherEntitlementPromise;
      if (GaaMetering.validateUserState(fetchedPublisherEntitlements)) {
        GaaMetering.userState = fetchedPublisherEntitlements as UserState;

        unlockArticleIfGranted();
      } else {
        debugLog("Publisher entitlement isn't valid");
      }
    }

    // Show the Google registration intervention.
    async function showGoogleRegwall() {
      debugLog('show Google Regwall');
      // Don't render the regwall until the window has loaded.
      await GaaMetering.getOnReadyPromise();

      if (googleApiClientId) {
        const jwt = await GaaMeteringRegwall.showWithNativeRegistrationButton({
          caslUrl,
          googleApiClientId,
          rawJwt,
        });

        // Handle registration for new users
        // Save credentials object so that registerUserPromise can use it using getGaaUser.
        if (jwt) {
          GaaMetering.setGaaUser(jwt);
        }
        const registerUserUserState = await registerUserPromise;
        debugLog('registerUserPromise resolved');
        if (GaaMetering.validateUserState(registerUserUserState)) {
          GaaMetering.userState = registerUserUserState as UserState;

          unlockArticleIfGranted();
        }
      } else {
        GaaMeteringRegwall.showWithNative3PRegistrationButton({
          caslUrl,
          authorizationUrl: authorizationUrl!,
        });
      }
    }

    function unlockArticleIfGranted(): void {
      if (!GaaMetering.validateUserState(GaaMetering.userState)) {
        debugLog('Invalid userState object');
        return;
      }
      if (GaaMetering.userState.granted === true) {
        const grantReasonToShowCaseEventMap = {
          [GrantReasonType.SUBSCRIBER]:
            ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_SUBSCRIPTION,
          [GrantReasonType.FREE]:
            ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_FREE_PAGE,
          [GrantReasonType.METERING]:
            ShowcaseEvent.EVENT_SHOWCASE_UNLOCKED_BY_METER,
        };

        if (GrantReasonType[GaaMetering.userState.grantReason] !== undefined) {
          callSwg((subscriptions) => {
            subscriptions.setShowcaseEntitlement({
              entitlement:
                grantReasonToShowCaseEventMap[
                  GaaMetering.userState.grantReason
                ],
              isUserRegistered: GaaMetering.isCurrentUserRegistered(),
              subscriptionTimestamp: GaaMetering.getSubscriptionTimestamp(),
            });
            debugLog('unlocked for ' + GaaMetering.userState.grantReason);
          });
        }
        // User has access from publisher so unlock article
        unlockArticle();
      } else {
        checkShowcaseEntitlement(GaaMetering.userState);
      }
    }

    function checkShowcaseEntitlement(userState: UserState) {
      if (userState.registrationTimestamp) {
        // Send userState to Google
        callSwg((subscriptions) => {
          debugLog('getting entitlements from Google');
          debugLog(GaaMetering.newUserStateToUserState(userState));
          const googleEntitlementsPromise = subscriptions.getEntitlements(
            GaaMetering.newUserStateToUserState(userState)
          );
          GaaMetering.setEntitlements(
            googleEntitlementsPromise,
            allowedReferrers,
            unlockArticle,
            handleSwGEntitlement,
            showGoogleRegwall,
            showPaywall
          );
        });
      } else {
        // If userState is undefined, it’s likely the user isn’t
        // logged in. Do not send an empty userState to Google in
        // this case.
        showGoogleRegwall();
      }
    }

    return true;
  }

  static async handleLoginRequest(
    handleLoginPromise: Promise<UserState> | null,
    unlockArticleIfGranted: () => void
  ): Promise<boolean> {
    GaaMetering.resolveLogin();
    const userState = await handleLoginPromise;
    if (GaaMetering.validateUserState(userState)) {
      GaaMetering.userState = userState!;
      GaaMeteringRegwall.remove();
      debugLog('GaaMeteringRegwall removed');
      unlockArticleIfGranted();
      return true;
    } else {
      debugLog('invalid handleLoginUserState');
      return false;
    }
  }

  private static async setEntitlementsForNoAccessUser_() {
    callSwg((subscriptions) => {
      switch (GaaMetering.userState.paywallReason) {
        case PaywallReasonType.RESERVED_USER:
          subscriptions.setShowcaseEntitlement({
            entitlement: ShowcaseEvent.EVENT_SHOWCASE_INELIGIBLE_PAYWALL,
            isUserRegistered: GaaMetering.isCurrentUserRegistered(),
            subscriptionTimestamp: GaaMetering.getSubscriptionTimestamp(),
          });
          break;
        default:
          subscriptions.setShowcaseEntitlement({
            entitlement: ShowcaseEvent.EVENT_SHOWCASE_NO_ENTITLEMENTS_PAYWALL,
            isUserRegistered: GaaMetering.isCurrentUserRegistered(),
            subscriptionTimestamp: GaaMetering.getSubscriptionTimestamp(),
          });
      }
    });
  }

  static async setEntitlements(
    googleEntitlementsPromise: Promise<Entitlements>,
    allowedReferrers: string[] | null,
    unlockArticle: (entitlements: Entitlements) => void,
    handleSwGEntitlement: (entitlements: Entitlements) => void,
    showGoogleRegwall: () => Promise<void>,
    showPaywall: () => void
  ) {
    // Wait for Google check to finish
    const googleEntitlement = await googleEntitlementsPromise;

    // Determine Google response from publisher response.
    if (googleEntitlement.enablesThisWithGoogleMetering()) {
      // Google returned metering entitlement so grant access
      googleEntitlement.consume(() => {
        // Consume the entitlement and trigger a dialog that lets the user
        // know Google provided them with a free read.
        unlockArticle(googleEntitlement);
      });
    } else if (googleEntitlement.enablesThis()) {
      // Google returned a non-metering entitlement
      // This is only relevant for publishers doing SwG
      handleSwGEntitlement(googleEntitlement);
    } else if (
      !GaaMetering.isCurrentUserRegistered() &&
      GaaMetering.isGaa(allowedReferrers)
    ) {
      // This is an anonymous user so show the Google registration intervention
      showGoogleRegwall();
    } else {
      // User does not any access from publisher or Google so show the standard paywall
      GaaMetering.setEntitlementsForNoAccessUser_();
      // Show the paywall
      showPaywall();
    }
  }

  static isCurrentUserRegistered(): boolean {
    return GaaMetering.isUserRegistered(GaaMetering.userState);
  }

  static isUserRegistered(userState: UserState): boolean {
    return userState.id !== undefined && userState.id !== '';
  }

  /**
   * Validates parameters for GaaMetering.init flow
   */
  static validateParameters(params: InitParamsDef): boolean {
    let noIssues = true;
    if (
      ('googleApiClientId' in params && 'authorizationUrl' in params) ||
      (!('googleApiClientId' in params) && !('authorizationUrl' in params))
    ) {
      debugLog(
        'Either googleApiClientId or authorizationUrl should be supplied but not both.'
      );
      noIssues = false;
    } else if ('authorizationUrl' in params) {
      if (
        !(typeof params.authorizationUrl === 'string') ||
        parseUrl(params.authorizationUrl).href !== params.authorizationUrl
      ) {
        debugLog('authorizationUrl is not a valid URL');
        noIssues = false;
      }
    } else if (
      !(typeof params.googleApiClientId === 'string') ||
      params.googleApiClientId.indexOf('.apps.googleusercontent.com') === -1
    ) {
      debugLog(
        'Missing googleApiClientId, or it is not a string, or it is not in a correct format'
      );
      noIssues = false;
    }

    if (
      !('allowedReferrers' in params && Array.isArray(params.allowedReferrers))
    ) {
      debugLog('Missing allowedReferrers or it is not an array');
      noIssues = false;
    }

    const reqFunc: ('showPaywall' | 'unlockArticle')[] =
      'showcaseEntitlement' in params
        ? ['showPaywall']
        : ['showPaywall', 'unlockArticle'];

    for (let reqFuncNo = 0; reqFuncNo < reqFunc.length; reqFuncNo++) {
      if (
        !(
          reqFunc[reqFuncNo] in params &&
          typeof params[reqFunc[reqFuncNo]] === 'function'
        )
      ) {
        debugLog(`Missing ${reqFunc[reqFuncNo]} or it is not a function`);
        noIssues = false;
      }
    }

    if (
      'handleSwGEntitlement' in params &&
      typeof params.handleSwGEntitlement !== 'function'
    ) {
      debugLog('handleSwGEntitlement is provided but it is not a function');
      noIssues = false;
    }

    const reqPromise: ('handleLoginPromise' | 'registerUserPromise')[] =
      'authorizationUrl' in params
        ? ['handleLoginPromise']
        : ['handleLoginPromise', 'registerUserPromise'];

    for (
      let reqPromiseNo = 0;
      reqPromiseNo < reqPromise.length;
      reqPromiseNo++
    ) {
      if (
        !(
          reqPromise[reqPromiseNo] in params &&
          GaaMetering.isPromise(params[reqPromise[reqPromiseNo]])
        )
      ) {
        debugLog(`Missing ${reqPromise[reqPromiseNo]} or it is not a promise`);
        noIssues = false;
      }
    }

    if (
      'publisherEntitlementPromise' in params &&
      !GaaMetering.isPromise(params.publisherEntitlementPromise)
    ) {
      debugLog(
        'publisherEntitlementPromise is provided but it is not a promise'
      );
      noIssues = false;
    }

    // For client-side paywall, either userState or publisherEntitlementPromise needs to provided
    // - If granted is not provided in a userState, publisherEntitlementPromise needs to be provided.
    // For server-side paywall, userState needs to be provided.
    if (params.paywallType == PaywallType.SERVER_SIDE) {
      if (!('userState' in params)) {
        debugLog('userState needs to be provided');
        noIssues = false;
      }
    } else if (
      !('userState' in params) &&
      !('publisherEntitlementPromise' in params)
    ) {
      debugLog(`userState or publisherEntitlementPromise needs to be provided`);
      noIssues = false;
    } else {
      const userState = params.userState;
      if (
        (!('granted' in userState) ||
          (userState.granted &&
            !GaaMetering.isArticleFreeFromPageConfig_() &&
            !('grantReason' in userState))) &&
        !('publisherEntitlementPromise' in params)
      ) {
        debugLog(
          'Either granted and grantReason have to be supplied or you have to provide pubisherEntitlementPromise'
        );
        noIssues = false;
      }
    }
    // Check userState is an 'object'
    if ('userState' in params && typeof params.userState !== 'object') {
      debugLog(`userState is not an object`);
      noIssues = false;
    }

    if ('paywallType' in params && !(params.paywallType in PaywallType)) {
      debugLog(`${params.paywallType} is not a valid paywallType`);
      noIssues = false;
    }

    if (
      'shouldInitializeSwG' in params &&
      typeof params.shouldInitializeSwG !== 'boolean'
    ) {
      debugLog(
        'shouldInitializeSwG is provided but the value is not a boolean'
      );
      noIssues = false;
    }

    return noIssues;
  }

  static determinePaywallType(params: InitParamsDef): PaywallType {
    if (params.showcaseEntitlement) {
      return PaywallType.SERVER_SIDE;
    } else {
      return params.paywallType ?? PaywallType.CLIENT_SIDE;
    }
  }

  static isGaa(publisherReferrers: string[] | null = []): boolean {
    // Validate GAA params.
    const queryString = QueryStringUtils.getQueryString();
    if (!queryStringHasFreshGaaParams(queryString, true)) {
      return false;
    }

    // Validate referrer.
    const referrer = parseUrl(self.document.referrer);
    if (
      !wasReferredByGoogle(referrer) &&
      publisherReferrers?.indexOf(referrer.hostname) === -1
    ) {
      // Real publications should bail if this referrer check fails.
      // This script is only logging a warning for metering demo purposes.
      debugLog(
        `This page's referrer ("${referrer.origin}") can't grant Google Article Access.`
      );

      return false;
    }

    return true;
  }

  static getProductIDFromPageConfig_(): string {
    const jsonLdPageConfig = GaaMetering.getProductIDFromJsonLdPageConfig_();
    if (jsonLdPageConfig) {
      return jsonLdPageConfig;
    }

    const microdataPageConfig =
      GaaMetering.getProductIDFromMicrodataPageConfig_();
    if (microdataPageConfig) {
      return microdataPageConfig;
    }

    throw new Error(
      'Showcase articles must define a publisher ID with either JSON-LD or Microdata.'
    );
  }

  /**
   * Gets publisher ID from JSON-LD page config.
   */
  private static getProductIDFromJsonLdPageConfig_(): string | void {
    const ldJsonElements = Array.from(
      self.document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      )
    );

    for (const ldJsonElement of ldJsonElements) {
      let ldJson = JSON.parse(ldJsonElement.textContent!);

      if (!Array.isArray(ldJson)) {
        ldJson = [ldJson];
      }

      const productId = ldJson.find(
        (entry: {isPartOf?: {productID: string}}) => entry?.isPartOf?.productID
      )?.isPartOf.productID;

      if (productId) {
        return productId;
      }
    }
  }

  /**
   * Gets product ID from Microdata page config.
   */
  private static getProductIDFromMicrodataPageConfig_(): string | void {
    const productIdElements = Array.from(
      self.document.querySelectorAll(
        '[itemscope][itemtype][itemprop="isPartOf"] [itemprop="productID"]'
      )
    );

    for (const productIdElement of productIdElements) {
      const productId = productIdElement.getAttribute('content');
      if (productId) {
        return productId;
      }
    }
  }

  private static isArticleFreeFromPageConfig_(): boolean {
    return (
      GaaMetering.isArticleFreeFromJsonLdPageConfig_() ||
      GaaMetering.isArticleFreeFromMicrodataPageConfig_() ||
      false
    );
  }

  private static isArticleFreeFromJsonLdPageConfig_(): boolean {
    const ldJsonElements = Array.from(
      self.document.querySelectorAll<HTMLScriptElement>(
        'script[type="application/ld+json"]'
      )
    );

    for (const ldJsonElement of ldJsonElements) {
      let ldJson = JSON.parse(ldJsonElement.textContent!);

      if (!Array.isArray(ldJson)) {
        ldJson = [ldJson];
      }

      const accessibleForFree = ldJson.find(
        (entry: {isAccessibleForFree?: boolean | string}) =>
          entry?.isAccessibleForFree
      )?.isAccessibleForFree;

      if (typeof accessibleForFree === 'boolean') {
        return accessibleForFree;
      }

      if (typeof accessibleForFree === 'string') {
        return accessibleForFree.toLowerCase() === 'true';
      }
    }

    return false;
  }

  private static isArticleFreeFromMicrodataPageConfig_(): boolean {
    const accessibleForFreeElements = Array.from(
      self.document.querySelectorAll(
        '[itemscope][itemtype] [itemprop="isAccessibleForFree"]'
      )
    );

    for (const accessibleForFreeElement of accessibleForFreeElements) {
      const accessibleForFree =
        accessibleForFreeElement.getAttribute('content');
      debugLog(typeof accessibleForFree);
      if (accessibleForFree) {
        const lowercase = accessibleForFree.toLowerCase();
        return lowercase === 'true';
      }
    }

    return false;
  }

  static isPromise(value: unknown): boolean {
    return (
      !!value && Object.prototype.toString.call(value) === '[object Promise]'
    );
  }

  static newUserStateToUserState(
    newUserState: UserState
  ): GetEntitlementsParamsExternalDef {
    // Convert registrationTimestamp to seconds
    const registrationTimestampSeconds = convertPotentialTimestampToSeconds(
      newUserState.registrationTimestamp
    );

    return {
      'metering': {
        'state': {
          'id': newUserState.id,
          'standardAttributes': {
            'registered_user': {
              'timestamp': registrationTimestampSeconds,
            },
          },
        },
      },
    };
  }

  static validateUserState(newUserState: UserState | null): boolean {
    if (!newUserState) {
      return false;
    }

    let noIssues = true;

    if (
      !('granted' in newUserState && typeof newUserState.granted === 'boolean')
    ) {
      debugLog(
        'userState.granted is missing or invalid (must be true or false)'
      );

      noIssues = false;
    }

    if (
      newUserState.granted === true &&
      !(newUserState.grantReason in GrantReasonType)
    ) {
      debugLog(
        'if userState.granted is true then userState.grantReason has to be either METERING, or SUBSCRIBER'
      );

      noIssues = false;
    }

    if (
      newUserState.granted === true &&
      newUserState.grantReason === GrantReasonType.SUBSCRIBER
    ) {
      if (
        !('id' in newUserState) ||
        !('registrationTimestamp' in newUserState)
      ) {
        debugLog(
          'Missing user ID or registrationTimestamp in userState object'
        );
        noIssues = false;
      } else {
        // Check if the provided timestamp is an integer
        if (
          !(
            typeof newUserState.registrationTimestamp === 'number' &&
            newUserState.registrationTimestamp % 1 === 0
          )
        ) {
          debugLog(
            'userState.registrationTimestamp invalid, userState.registrationTimestamp needs to be an integer and in seconds'
          );

          noIssues = false;
        } else if (
          convertPotentialTimestampToSeconds(
            newUserState.registrationTimestamp
          ) >
          Date.now() / 1000
        ) {
          debugLog('userState.registrationTimestamp is in the future');

          noIssues = false;
        }

        if (newUserState.grantReason === GrantReasonType.SUBSCRIBER) {
          if (!('subscriptionTimestamp' in newUserState)) {
            debugLog(
              'subscriptionTimestamp is required if userState.grantReason is SUBSCRIBER'
            );

            noIssues = false;
          } else if (
            // Check if the provided timestamp is an integer
            !(
              typeof newUserState.subscriptionTimestamp === 'number' &&
              newUserState.subscriptionTimestamp % 1 === 0
            )
          ) {
            debugLog(
              'userState.subscriptionTimestamp invalid, userState.subscriptionTimestamp needs to be an integer and in seconds'
            );

            noIssues = false;
          } else if (
            convertPotentialTimestampToSeconds(
              newUserState.subscriptionTimestamp
            ) >
            Date.now() / 1000
          ) {
            debugLog('userState.subscriptionTimestamp is in the future');
            noIssues = false;
          }
        }
      }
    }

    if ('id' in newUserState || 'registrationTimestamp' in newUserState) {
      if (!('id' in newUserState)) {
        debugLog('Missing user ID in userState object');
        return false;
      }

      if (!('registrationTimestamp' in newUserState)) {
        debugLog('Missing registrationTimestamp in userState object');
        return false;
      }
    }

    if ('paywallReason' in newUserState) {
      if (newUserState.granted) {
        debugLog(
          'userState.granted must be false when paywallReason is supplied.'
        );
        noIssues = false;
      }

      if (!(newUserState.paywallReason in PaywallReasonType)) {
        debugLog(
          'userState.paywallReason has to be empty or set to RESERVED_USER.'
        );
        noIssues = false;
      }
    }
    return noIssues;
  }

  static getOnReadyPromise(): Promise<void> {
    return new Promise((resolve) => {
      if (self.document.readyState === 'complete') {
        resolve();
      } else {
        self.window.addEventListener('load', () => {
          resolve();
        });
      }
    });
  }

  static getSubscriptionTimestamp(): number | null {
    return GaaMetering?.userState?.subscriptionTimestamp || null;
  }
}
