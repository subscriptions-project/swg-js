/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License atCONST_GOOGLE_LOGO
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ActionTimestamps, ActionsTimestamps} from './frequency-capping-utils';
import {
  AnalyticsEvent,
  CtaMode,
  EventParams,
  SkuSelectedResponse,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from '../runtime/client-config-manager';
import {Deps} from '../runtime/deps';
import {GoogleAnalyticsEventListener} from '../runtime/google-analytics-event-listener';
import {I18N_STRINGS} from '../i18n/strings';
import {Intervention, PromptPreference} from '../runtime/intervention';
import {InterventionType} from '../api/intervention-type';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from '../runtime/pay-flow';
import {ProductType, SubscriptionRequest} from '../api/subscriptions';
import {StorageKeys} from './constants';
import {Toast} from '../ui/toast';
import {feUrl} from '../runtime/services';
import {msg} from './i18n';
import {parseQueryString} from './url';
import {pruneTimestamps} from '../runtime/storage';

const INLINE_CTA_LABEL = 'CTA_MODE_INLINE';

/** Show a toast idicating that reader has already registered before. */
export function showAlreadyOptedInToast(
  actionType: string,
  lang: string,
  deps: Deps
): void {
  let urlParams;
  switch (actionType) {
    case 'TYPE_REGISTRATION_WALL':
      // Show 'Signed in as abc@gmail.com' toast on the pub page.
      urlParams = {
        flavor: 'basic',
      };
      break;
    case 'TYPE_NEWSLETTER_SIGNUP':
      const customText = msg(I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP, lang);
      urlParams = {
        flavor: 'custom',
        customText,
      };
      break;
    default:
      // Do not show toast for other types.
      return;
  }
  new Toast(deps, feUrl('/toastiframe', urlParams)).open();
}

/**
 * Gets the complete contribution URL that should be used for the activity iFrame view.
 */
export function getContributionsUrl(
  clientConfig: ClientConfig,
  clientConfigManager: ClientConfigManager,
  pageConfig: PageConfig,
  configurationId: string = '',
  isInlineCta: boolean = false
): string {
  if (!clientConfig.useUpdatedOfferFlows) {
    return feUrl('/contributionsiframe');
  }

  const params: {[key: string]: string} = {
    'publicationId': pageConfig.getPublicationId(),
  };

  if (clientConfigManager.shouldForceLangInIframes()) {
    params['hl'] = clientConfigManager.getLanguage();
  }
  if (clientConfig.uiPredicates?.purchaseUnavailableRegion) {
    params['purchaseUnavailableRegion'] = 'true';
  }
  if (isInlineCta) {
    params['ctaMode'] = INLINE_CTA_LABEL;
  }
  if (configurationId) {
    params['configurationId'] = configurationId;
  }

  return feUrl('/contributionoffersiframe', params);
}

export function startContributionPayFlow(
  deps: Deps,
  response: SkuSelectedResponse,
  isInlineCta: boolean = false,
  configId: string = ''
): void {
  const sku = response.getSku();
  const isOneTime = response.getOneTime();
  if (sku) {
    const contributionRequest: SubscriptionRequest = {
      'skuId': sku,
    };
    if (isOneTime) {
      contributionRequest['oneTime'] = isOneTime;
    }
    if (isInlineCta) {
      deps.analytics().addLabels([INLINE_CTA_LABEL]);
    } else {
      deps.analytics().removeLabels([INLINE_CTA_LABEL]);
    }
    new PayStartFlow(
      deps,
      contributionRequest,
      ProductType.UI_CONTRIBUTION,
      isInlineCta,
      configId
    ).start();
  }
}

/**
 * Gets the complete subscription offers URL that should be used for the activity iFrame view.
 */
export function getSubscriptionUrl(
  clientConfig: ClientConfig,
  clientConfigManager: ClientConfigManager,
  pageConfig: PageConfig,
  query: string,
  configurationId: string = '',
  isInlineCta: boolean = false
): string {
  if (!clientConfig.useUpdatedOfferFlows) {
    const offerCardParam = parseQueryString(query)['swg.newoffercard'];
    const params: {[key: string]: string} = offerCardParam
      ? {'useNewOfferCard': offerCardParam}
      : {};
    return feUrl('/offersiframe', params);
  }

  const params: {[key: string]: string} = {
    'publicationId': pageConfig.getPublicationId(),
  };

  if (clientConfigManager.shouldForceLangInIframes()) {
    params['hl'] = clientConfigManager.getLanguage();
  }

  if (clientConfig.uiPredicates?.purchaseUnavailableRegion) {
    params['purchaseUnavailableRegion'] = 'true';
  }

  if (isInlineCta) {
    params['ctaMode'] = INLINE_CTA_LABEL;
  }

  if (configurationId) {
    params['configurationId'] = configurationId;
  }

  return feUrl('/subscriptionoffersiframe', params);
}

export function startSubscriptionPayFlow(
  deps: Deps,
  response: SkuSelectedResponse,
  isInlineCta: boolean = false,
  configId: string = ''
): void {
  const sku = response.getSku();
  if (sku) {
    const subscriptionRequest: SubscriptionRequest = {
      'skuId': sku,
    };
    const oldSku = response.getOldSku();
    if (oldSku) {
      subscriptionRequest['oldSku'] = oldSku;
      deps.analytics().setSku(oldSku);
    }

    if (isInlineCta) {
      deps.analytics().addLabels([INLINE_CTA_LABEL]);
    } else {
      deps.analytics().removeLabels([INLINE_CTA_LABEL]);
    }

    deps
      .eventManager()
      .logSwgEvent(
        AnalyticsEvent.ACTION_OFFER_SELECTED,
        true,
        getEventParams(sku, isInlineCta)
      );
    new PayStartFlow(
      deps,
      subscriptionRequest,
      ProductType.SUBSCRIPTION,
      isInlineCta,
      configId
    ).start();
  }
}

function getEventParams(sku: string, isInlineCta: boolean): EventParams {
  const eventParams: EventParams = new EventParams();
  eventParams.setSku(sku);
  eventParams.setCtaMode(
    isInlineCta ? CtaMode.CTA_MODE_INLINE : CtaMode.CTA_MODE_POPUP
  );
  return eventParams;
}

export function startNativeFlow(
  deps: Deps,
  response: ViewSubscriptionsResponse
): void {
  if (response.getNative()) {
    deps.callbacks().triggerSubscribeRequest();
  }
}

/**
 * Fetches frequency capping timestamps from local storage for prompts.
 * Timestamps are not necessarily sorted.
 */
export async function getTimestamps(deps: Deps): Promise<ActionsTimestamps> {
  const storage = deps.storage();
  const stringified = await storage.get(
    StorageKeys.TIMESTAMPS,
    /* useLocalStorage */ true
  );
  if (!stringified) {
    return {};
  }

  let timestamps: ActionsTimestamps;
  try {
    timestamps = JSON.parse(stringified);
  } catch {
    deps
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR);
    return {};
  }

  if (!isValidActionsTimestamps(timestamps)) {
    deps
      .eventManager()
      .logSwgEvent(AnalyticsEvent.EVENT_LOCAL_STORAGE_TIMESTAMPS_PARSING_ERROR);
    return {};
  }
  return Object.entries(timestamps).reduce(
    (acc: ActionsTimestamps, [key, value]: [string, ActionTimestamps]) => {
      return {
        ...acc,
        [key]: {
          impressions: pruneTimestamps(value.impressions),
          dismissals: pruneTimestamps(value.dismissals),
          completions: pruneTimestamps(value.completions),
        },
      };
    },
    {}
  );
}

function isValidActionsTimestamps(timestamps: ActionsTimestamps) {
  return (
    timestamps instanceof Object &&
    !(timestamps instanceof Array) &&
    Object.values(
      Object.values(timestamps).map(
        (t) =>
          Object.keys(t).length === 3 &&
          t.impressions.every((n) => !isNaN(n)) &&
          t.dismissals.every((n) => !isNaN(n)) &&
          t.completions.every((n) => !isNaN(n))
      )
    ).every(Boolean)
  );
}

/**
 * Checks AudienceAction eligbility, used to filter potential actions.
 */
export function isActionEligible(
  action: Intervention,
  deps: Deps,
  timestamps: ActionsTimestamps
): boolean {
  if (action.type === InterventionType.TYPE_REWARDED_SURVEY) {
    const isAnalyticsEligible =
      GoogleAnalyticsEventListener.isGaEligible(deps) ||
      GoogleAnalyticsEventListener.isGtagEligible(deps) ||
      GoogleAnalyticsEventListener.isGtmEligible(deps);
    if (!isAnalyticsEligible) {
      return false;
    }

    // Do not show survey if there is a previous completion record.
    // Client side eligibility is required to handle identity transitions
    // after sign-in flow.
    const completions = (
      timestamps[action.configurationId!] ||
      timestamps[InterventionType.TYPE_REWARDED_SURVEY]
    )?.completions;
    return !(completions || []).length;
  }

  // NOTE: passing these checks does not mean the APIs are always available.
  if (action.type === InterventionType.TYPE_REWARDED_AD) {
    if (action.preference === PromptPreference.PREFERENCE_ADSENSE_REWARDED_AD) {
      const adsbygoogle = deps.win().adsbygoogle;
      if (!adsbygoogle?.loaded) {
        deps
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_ADSENSE_FILTERED);
        return false;
      }
    } else {
      const googletag = deps.win().googletag;
      // Because this happens after the article call, googletag should have had enough time to set up
      if (!googletag?.getVersion()) {
        deps
          .eventManager()
          .logSwgEvent(AnalyticsEvent.EVENT_REWARDED_AD_GPT_FILTERED);
        return false;
      }
    }
  }

  return true;
}
