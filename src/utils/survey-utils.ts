/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {
  AnalyticsEvent,
  CtaMode,
  EventOriginator,
  EventParams,
  SurveyDataTransferRequest,
  SurveyDataTransferResponse,
} from '../proto/api_messages';
import {Constants, StorageKeysWithoutPublicationIdSuffix} from './constants';
import {Deps} from '../runtime/deps';
import {GoogleAnalyticsEventListener} from '../runtime/google-analytics-event-listener';
import {InterventionResult} from '../api/available-intervention';
import {warn} from '../utils/log';

/* Supports survey data tansfer, log survey events and store PPS values.*/
export async function handleSurveyDataTransferRequest(
  request: SurveyDataTransferRequest,
  deps: Deps,
  activityIframeView: ActivityIframeView,
  configurationId: string,
  ctaMode: CtaMode,
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean
): Promise<void> {
  const dataTransferSuccess = await attemptSurveyDataTransfer(
    request,
    configurationId,
    deps,
    ctaMode,
    onResult
  );
  if (dataTransferSuccess) {
    deps
      .eventManager()
      .logSwgEvent(
        AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_COMPLETE,
        /* isFromUserAction */ true,
        /* eventParams */ ctaMode === CtaMode.CTA_MODE_INLINE
          ? getInlineCtaEventParams()
          : null
      );
  } else {
    deps
      .eventManager()
      .logSwgEvent(
        AnalyticsEvent.EVENT_SURVEY_DATA_TRANSFER_FAILED,
        /* isFromUserAction */ false,
        /* eventParams */ ctaMode === CtaMode.CTA_MODE_INLINE
          ? getInlineCtaEventParams()
          : null
      );
  }
  const surveyDataTransferResponse = new SurveyDataTransferResponse();
  const isPpsEligible = request.getStorePpsInLocalStorage();

  if (isPpsEligible) {
    await storePpsValuesFromSurveyAnswers(request, deps);
  }
  surveyDataTransferResponse.setSuccess(dataTransferSuccess);
  activityIframeView.execute(surveyDataTransferResponse);
}

/**
 * Attempts to log survey data.
 */
async function attemptSurveyDataTransfer(
  request: SurveyDataTransferRequest,
  configurationId: string,
  deps: Deps,
  ctaMode: CtaMode,
  onResult?: (result: InterventionResult) => Promise<boolean> | boolean
): Promise<boolean> {
  // @TODO(justinchou): execute callback with setOnInterventionComplete
  // then check for success
  if (onResult) {
    try {
      return await onResult({
        configurationId,
        data: request,
      });
    } catch (e) {
      warn(`[swg.js] Exception in publisher provided logging callback: ${e}`);
      return false;
    }
  }
  return logSurveyDataToGoogleAnalytics(request, deps, ctaMode);
}

/*
 * Logs SurveyDataTransferRequest to Google Analytics, which contains payload to surface as dimensions in Google Analytics (GA4, UA, GTM).
 * Returns whether or not logging was successful.
 */
function logSurveyDataToGoogleAnalytics(
  request: SurveyDataTransferRequest,
  deps: Deps,
  ctaMode: CtaMode
): boolean {
  if (
    !GoogleAnalyticsEventListener.isGaEligible(deps) &&
    !GoogleAnalyticsEventListener.isGtagEligible(deps) &&
    !GoogleAnalyticsEventListener.isGtmEligible(deps)
  ) {
    return false;
  }
  request.getSurveyQuestionsList()?.map((question) => {
    const event = {
      eventType: AnalyticsEvent.ACTION_SURVEY_DATA_TRANSFER,
      eventOriginator: EventOriginator.SWG_CLIENT,
      isFromUserAction: true,
      additionalParameters:
        ctaMode === CtaMode.CTA_MODE_INLINE
          ? {ctaMode: CtaMode.CTA_MODE_INLINE}
          : null,
    };
    question.getSurveyAnswersList()?.map((answer) => {
      const eventParams = {
        googleAnalyticsParameters: {
          // Custom dimensions.
          'survey_question': question.getQuestionText() || '',
          'survey_question_category': question.getQuestionCategory() || '',
          'survey_answer': answer.getAnswerText() || '',
          'survey_answer_category': answer.getAnswerCategory() || '',
          // GA4 Default dimensions.
          'content_id': question.getQuestionCategory() || '',
          'content_group': question.getQuestionText() || '',
          'content_type': answer.getAnswerText() || '',
          // UA Default dimensions.
          // TODO(yeongjinoh): Remove default dimensions once beta publishers
          // complete migration to GA4.
          'event_category': question.getQuestionCategory() || '',
          'event_label': answer.getAnswerText() || '',
        },
      };
      deps.eventManager().logEvent(event, eventParams);
    });
  });
  return true;
}

/**
 * Populates localStorage with PPS configuration parameters based on
 * SurveyDataTransferRequest.
 **/
async function storePpsValuesFromSurveyAnswers(
  request: SurveyDataTransferRequest,
  deps: Deps
): Promise<void> {
  const iabAudienceKey = StorageKeysWithoutPublicationIdSuffix.PPS_TAXONOMIES;
  // PPS value field is optional and category may not be populated
  // in accordance to IAB taxonomies.
  const ppsConfigParams = request
    .getSurveyQuestionsList()!
    .flatMap((question) => question.getSurveyAnswersList())
    .map((answer) => answer?.getPpsValue())
    .filter((ppsValue) => ppsValue !== null);

  const existingIabTaxonomy = await deps
    .storage()
    .get(iabAudienceKey, /* useLocalStorage= */ true);
  let existingIabTaxonomyValues: string[] = [];
  try {
    const parsedExistingIabTaxonomyValues = JSON.parse(existingIabTaxonomy!)?.[
      Constants.PPS_AUDIENCE_TAXONOMY_KEY
    ]?.values;
    existingIabTaxonomyValues = Array.isArray(parsedExistingIabTaxonomyValues)
      ? parsedExistingIabTaxonomyValues
      : [];
  } catch {
    // Ignore error since it defaults to empty array.
  }

  const iabTaxonomyValues = Array.from(
    new Set(ppsConfigParams.concat(existingIabTaxonomyValues))
  );
  const iabTaxonomy = {
    [Constants.PPS_AUDIENCE_TAXONOMY_KEY]: {values: iabTaxonomyValues},
  };

  await Promise.resolve(
    deps
      .storage()
      .set(
        iabAudienceKey,
        JSON.stringify(iabTaxonomy),
        /* useLocalStorage= */ true
      )
  );
  // TODO(caroljli): clearcut event logging
}

function getInlineCtaEventParams(): EventParams {
  const eventParams: EventParams = new EventParams();
  eventParams.setCtaMode(CtaMode.CTA_MODE_INLINE);
  return eventParams;
}
