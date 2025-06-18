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

import {
  AnalyticsEvent,
  EventParams,
  SkuSelectedResponse,
  ViewSubscriptionsResponse,
} from '../proto/api_messages';
import {ClientConfig} from '../model/client-config';
import {ClientConfigManager} from '../runtime/client-config-manager';
import {Deps} from '../runtime/deps';
import {PageConfig} from '../model/page-config';
import {PayStartFlow} from '../runtime/pay-flow';
import {ProductType, SubscriptionRequest} from '../api/subscriptions';
import {SWG_I18N_STRINGS} from '../i18n/swg-strings';
import {Toast} from '../ui/toast';
import {feUrl} from '../runtime/services';
import {msg} from './i18n';
import {parseQueryString} from './url';

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
      const customText = msg(
        SWG_I18N_STRINGS.NEWSLETTER_ALREADY_SIGNED_UP_LANG_MAP,
        lang
      )!;
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
  if (isInlineCta) {
    params['ctaMode'] = 'CTA_MODE_INLINE';
  }

  return feUrl('/contributionoffersiframe', params);
}

export function startPayFlow(deps: Deps, response: SkuSelectedResponse): void {
  const sku = response.getSku();
  const isOneTime = response.getOneTime();
  if (sku) {
    const contributionRequest: SubscriptionRequest = {
      'skuId': sku,
    };
    if (isOneTime) {
      contributionRequest['oneTime'] = isOneTime;
    }
    new PayStartFlow(
      deps,
      contributionRequest,
      ProductType.UI_CONTRIBUTION
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
    params['ctaMode'] = 'CTA_MODE_INLINE';
  }

  return feUrl('/subscriptionoffersiframe', params);
}

export function startSubscriptionPayFlow(
  deps: Deps,
  response: SkuSelectedResponse
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
    deps
      .eventManager()
      .logSwgEvent(
        AnalyticsEvent.ACTION_OFFER_SELECTED,
        true,
        getEventParams(sku)
      );
    new PayStartFlow(deps, subscriptionRequest).start();
  }
}

function getEventParams(sku: string): EventParams {
  return new EventParams([, , , , sku]);
}

export function startNativeFlow(
  deps: Deps,
  response: ViewSubscriptionsResponse
): void {
  if (response.getNative()) {
    deps.callbacks().triggerSubscribeRequest();
  }
}
