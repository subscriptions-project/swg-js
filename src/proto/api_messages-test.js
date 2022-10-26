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

/**
 * @fileoverview Protos for SwG client/iframe messaging
 * Auto generated, do not edit
 */

import {AccountCreationRequest, ActionRequest, ActionType, AlreadySubscribedResponse, AnalyticsContext, AnalyticsEvent, AnalyticsEventMeta, AnalyticsRequest, AudienceActivityClientLogsRequest, CompleteAudienceActionResponse, EntitlementJwt, EntitlementResult, EntitlementSource, EntitlementsRequest, EntitlementsResponse, EventOriginator, EventParams, FinishedLoggingResponse, LinkSaveTokenRequest, LinkingInfoResponse, OpenDialogRequest, ReaderSurfaceType, SkuSelectedResponse, SmartBoxMessage, SubscribeResponse, SubscriptionLinkingCompleteResponse, SubscriptionLinkingResponse, SurveyAnswer, SurveyDataTransferRequest, SurveyDataTransferResponse, SurveyQuestion, Timestamp, ToastCloseRequest, ViewSubscriptionsResponse, deserialize, getLabel} from './api_messages';

describe('deserialize', () => {
  it('throws if deserialization fails', () => {
    expect(() => deserialize(['fakeDataType'])).to.throw('Deserialization failed for fakeDataType');
    expect(() => deserialize()).to.throw(
      'Deserialization failed for undefined'
    );
  });
});

describe('getLabel', () => {
  it('gets label from a proto constructor', () => {
    expect(getLabel(AccountCreationRequest)).to.equal('AccountCreationRequest');
  });
});

describe('AccountCreationRequest', () => {
  it('should deserialize correctly', () => {
    const /** !AccountCreationRequest  */ accountcreationrequest1 = new AccountCreationRequest();
    accountcreationrequest1.setComplete(false);

    let accountcreationrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    accountcreationrequestDeserialized = deserialize(
        accountcreationrequest1.toArray(undefined));
    expect(accountcreationrequestDeserialized.toArray(undefined)).to.deep.equal(
        accountcreationrequest1.toArray(undefined));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest1.getComplete());

    // Verify includeLabel true
    // Verify serialized arrays.
    accountcreationrequestDeserialized = deserialize(
        accountcreationrequest1.toArray(true));
    expect(accountcreationrequestDeserialized.toArray(true)).to.deep.equal(
        accountcreationrequest1.toArray(true));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest1.getComplete());

    // Verify includeLabel false
    // Verify serialized arrays.
    accountcreationrequestDeserialized = new AccountCreationRequest(accountcreationrequest1.toArray(false), false);
    expect(accountcreationrequestDeserialized.toArray(false)).to.deep.equal(
        accountcreationrequest1.toArray(false));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest1.getComplete());
  });
});

describe('ActionRequest', () => {
  it('should deserialize correctly', () => {
    const /** !ActionRequest  */ actionrequest1 = new ActionRequest();
    actionrequest1.setAction(ActionType.ACTION_TYPE_UNKNOWN);

    let actionrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    actionrequestDeserialized = deserialize(
        actionrequest1.toArray(undefined));
    expect(actionrequestDeserialized.toArray(undefined)).to.deep.equal(
        actionrequest1.toArray(undefined));

    // Verify fields.
    expect(actionrequestDeserialized.getAction()).to.deep.equal(
        actionrequest1.getAction());

    // Verify includeLabel true
    // Verify serialized arrays.
    actionrequestDeserialized = deserialize(
        actionrequest1.toArray(true));
    expect(actionrequestDeserialized.toArray(true)).to.deep.equal(
        actionrequest1.toArray(true));

    // Verify fields.
    expect(actionrequestDeserialized.getAction()).to.deep.equal(
        actionrequest1.getAction());

    // Verify includeLabel false
    // Verify serialized arrays.
    actionrequestDeserialized = new ActionRequest(actionrequest1.toArray(false), false);
    expect(actionrequestDeserialized.toArray(false)).to.deep.equal(
        actionrequest1.toArray(false));

    // Verify fields.
    expect(actionrequestDeserialized.getAction()).to.deep.equal(
        actionrequest1.getAction());
  });
});

describe('AlreadySubscribedResponse', () => {
  it('should deserialize correctly', () => {
    const /** !AlreadySubscribedResponse  */ alreadysubscribedresponse1 = new AlreadySubscribedResponse();
    alreadysubscribedresponse1.setSubscriberOrMember(false);
    alreadysubscribedresponse1.setLinkRequested(false);

    let alreadysubscribedresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = deserialize(
        alreadysubscribedresponse1.toArray(undefined));
    expect(alreadysubscribedresponseDeserialized.toArray(undefined)).to.deep.equal(
        alreadysubscribedresponse1.toArray(undefined));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse1.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse1.getLinkRequested());

    // Verify includeLabel true
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = deserialize(
        alreadysubscribedresponse1.toArray(true));
    expect(alreadysubscribedresponseDeserialized.toArray(true)).to.deep.equal(
        alreadysubscribedresponse1.toArray(true));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse1.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse1.getLinkRequested());

    // Verify includeLabel false
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = new AlreadySubscribedResponse(alreadysubscribedresponse1.toArray(false), false);
    expect(alreadysubscribedresponseDeserialized.toArray(false)).to.deep.equal(
        alreadysubscribedresponse1.toArray(false));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse1.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse1.getLinkRequested());
  });
});

describe('AnalyticsContext', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsContext  */ analyticscontext1 = new AnalyticsContext();
    analyticscontext1.setEmbedderOrigin('');
    analyticscontext1.setTransactionId('');
    analyticscontext1.setReferringOrigin('');
    analyticscontext1.setUtmSource('');
    analyticscontext1.setUtmCampaign('');
    analyticscontext1.setUtmMedium('');
    analyticscontext1.setSku('');
    analyticscontext1.setReadyToPay(false);
    analyticscontext1.setLabelList([]);
    analyticscontext1.setClientVersion('');
    analyticscontext1.setUrl('');
    const /** !Timestamp  */ timestamp1 = new Timestamp();
    timestamp1.setSeconds(0);
    timestamp1.setNanos(0);
    analyticscontext1.setClientTimestamp(timestamp1);
    analyticscontext1.setReaderSurfaceType(ReaderSurfaceType.READER_SURFACE_TYPE_UNSPECIFIED);
    analyticscontext1.setIntegrationVersion('');

    let analyticscontextDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticscontextDeserialized = deserialize(
        analyticscontext1.toArray(undefined));
    expect(analyticscontextDeserialized.toArray(undefined)).to.deep.equal(
        analyticscontext1.toArray(undefined));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext1.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext1.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext1.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext1.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext1.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext1.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext1.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext1.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext1.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext1.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext1.getUrl());
    expect(analyticscontextDeserialized.getClientTimestamp()).to.deep.equal(
        analyticscontext1.getClientTimestamp());
    expect(analyticscontextDeserialized.getReaderSurfaceType()).to.deep.equal(
        analyticscontext1.getReaderSurfaceType());
    expect(analyticscontextDeserialized.getIntegrationVersion()).to.deep.equal(
        analyticscontext1.getIntegrationVersion());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticscontextDeserialized = deserialize(
        analyticscontext1.toArray(true));
    expect(analyticscontextDeserialized.toArray(true)).to.deep.equal(
        analyticscontext1.toArray(true));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext1.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext1.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext1.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext1.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext1.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext1.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext1.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext1.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext1.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext1.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext1.getUrl());
    expect(analyticscontextDeserialized.getClientTimestamp()).to.deep.equal(
        analyticscontext1.getClientTimestamp());
    expect(analyticscontextDeserialized.getReaderSurfaceType()).to.deep.equal(
        analyticscontext1.getReaderSurfaceType());
    expect(analyticscontextDeserialized.getIntegrationVersion()).to.deep.equal(
        analyticscontext1.getIntegrationVersion());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticscontextDeserialized = new AnalyticsContext(analyticscontext1.toArray(false), false);
    expect(analyticscontextDeserialized.toArray(false)).to.deep.equal(
        analyticscontext1.toArray(false));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext1.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext1.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext1.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext1.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext1.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext1.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext1.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext1.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext1.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext1.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext1.getUrl());
    expect(analyticscontextDeserialized.getClientTimestamp()).to.deep.equal(
        analyticscontext1.getClientTimestamp());
    expect(analyticscontextDeserialized.getReaderSurfaceType()).to.deep.equal(
        analyticscontext1.getReaderSurfaceType());
    expect(analyticscontextDeserialized.getIntegrationVersion()).to.deep.equal(
        analyticscontext1.getIntegrationVersion());
  });
});

describe('AnalyticsEventMeta', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsEventMeta  */ analyticseventmeta1 = new AnalyticsEventMeta();
    analyticseventmeta1.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
    analyticseventmeta1.setIsFromUserAction(false);

    let analyticseventmetaDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticseventmetaDeserialized = deserialize(
        analyticseventmeta1.toArray(undefined));
    expect(analyticseventmetaDeserialized.toArray(undefined)).to.deep.equal(
        analyticseventmeta1.toArray(undefined));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta1.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta1.getIsFromUserAction());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticseventmetaDeserialized = deserialize(
        analyticseventmeta1.toArray(true));
    expect(analyticseventmetaDeserialized.toArray(true)).to.deep.equal(
        analyticseventmeta1.toArray(true));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta1.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta1.getIsFromUserAction());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticseventmetaDeserialized = new AnalyticsEventMeta(analyticseventmeta1.toArray(false), false);
    expect(analyticseventmetaDeserialized.toArray(false)).to.deep.equal(
        analyticseventmeta1.toArray(false));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta1.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta1.getIsFromUserAction());
  });
});

describe('AnalyticsRequest', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsRequest  */ analyticsrequest1 = new AnalyticsRequest();
    const /** !AnalyticsContext  */ analyticscontext1 = new AnalyticsContext();
    analyticscontext1.setEmbedderOrigin('');
    analyticscontext1.setTransactionId('');
    analyticscontext1.setReferringOrigin('');
    analyticscontext1.setUtmSource('');
    analyticscontext1.setUtmCampaign('');
    analyticscontext1.setUtmMedium('');
    analyticscontext1.setSku('');
    analyticscontext1.setReadyToPay(false);
    analyticscontext1.setLabelList([]);
    analyticscontext1.setClientVersion('');
    analyticscontext1.setUrl('');
    const /** !Timestamp  */ timestamp1 = new Timestamp();
    timestamp1.setSeconds(0);
    timestamp1.setNanos(0);
    analyticscontext1.setClientTimestamp(timestamp1);
    analyticscontext1.setReaderSurfaceType(ReaderSurfaceType.READER_SURFACE_TYPE_UNSPECIFIED);
    analyticscontext1.setIntegrationVersion('');
    analyticsrequest1.setContext(analyticscontext1);
    analyticsrequest1.setEvent(AnalyticsEvent.UNKNOWN);
    const /** !AnalyticsEventMeta  */ analyticseventmeta1 = new AnalyticsEventMeta();
    analyticseventmeta1.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
    analyticseventmeta1.setIsFromUserAction(false);
    analyticsrequest1.setMeta(analyticseventmeta1);
    const /** !EventParams  */ eventparams1 = new EventParams();
    eventparams1.setSmartboxMessage('');
    eventparams1.setGpayTransactionId('');
    eventparams1.setHadLogged(false);
    eventparams1.setSku('');
    eventparams1.setOldTransactionId('');
    eventparams1.setIsUserRegistered(false);
    eventparams1.setSubscriptionFlow('');
    const /** !Timestamp  */ timestamp2 = new Timestamp();
    timestamp2.setSeconds(0);
    timestamp2.setNanos(0);
    eventparams1.setSubscriptionTimestamp(timestamp2);
    analyticsrequest1.setParams(eventparams1);

    let analyticsrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticsrequestDeserialized = deserialize(
        analyticsrequest1.toArray(undefined));
    expect(analyticsrequestDeserialized.toArray(undefined)).to.deep.equal(
        analyticsrequest1.toArray(undefined));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest1.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest1.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest1.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest1.getParams());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticsrequestDeserialized = deserialize(
        analyticsrequest1.toArray(true));
    expect(analyticsrequestDeserialized.toArray(true)).to.deep.equal(
        analyticsrequest1.toArray(true));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest1.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest1.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest1.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest1.getParams());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticsrequestDeserialized = new AnalyticsRequest(analyticsrequest1.toArray(false), false);
    expect(analyticsrequestDeserialized.toArray(false)).to.deep.equal(
        analyticsrequest1.toArray(false));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest1.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest1.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest1.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest1.getParams());
  });
});

describe('AudienceActivityClientLogsRequest', () => {
  it('should deserialize correctly', () => {
    const /** !AudienceActivityClientLogsRequest  */ audienceactivityclientlogsrequest1 = new AudienceActivityClientLogsRequest();
    audienceactivityclientlogsrequest1.setEvent(AnalyticsEvent.UNKNOWN);

    let audienceactivityclientlogsrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    audienceactivityclientlogsrequestDeserialized = deserialize(
        audienceactivityclientlogsrequest1.toArray(undefined));
    expect(audienceactivityclientlogsrequestDeserialized.toArray(undefined)).to.deep.equal(
        audienceactivityclientlogsrequest1.toArray(undefined));

    // Verify fields.
    expect(audienceactivityclientlogsrequestDeserialized.getEvent()).to.deep.equal(
        audienceactivityclientlogsrequest1.getEvent());

    // Verify includeLabel true
    // Verify serialized arrays.
    audienceactivityclientlogsrequestDeserialized = deserialize(
        audienceactivityclientlogsrequest1.toArray(true));
    expect(audienceactivityclientlogsrequestDeserialized.toArray(true)).to.deep.equal(
        audienceactivityclientlogsrequest1.toArray(true));

    // Verify fields.
    expect(audienceactivityclientlogsrequestDeserialized.getEvent()).to.deep.equal(
        audienceactivityclientlogsrequest1.getEvent());

    // Verify includeLabel false
    // Verify serialized arrays.
    audienceactivityclientlogsrequestDeserialized = new AudienceActivityClientLogsRequest(audienceactivityclientlogsrequest1.toArray(false), false);
    expect(audienceactivityclientlogsrequestDeserialized.toArray(false)).to.deep.equal(
        audienceactivityclientlogsrequest1.toArray(false));

    // Verify fields.
    expect(audienceactivityclientlogsrequestDeserialized.getEvent()).to.deep.equal(
        audienceactivityclientlogsrequest1.getEvent());
  });
});

describe('CompleteAudienceActionResponse', () => {
  it('should deserialize correctly', () => {
    const /** !CompleteAudienceActionResponse  */ completeaudienceactionresponse1 = new CompleteAudienceActionResponse();
    completeaudienceactionresponse1.setSwgUserToken('');
    completeaudienceactionresponse1.setActionCompleted(false);
    completeaudienceactionresponse1.setUserEmail('');
    completeaudienceactionresponse1.setAlreadyCompleted(false);

    let completeaudienceactionresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    completeaudienceactionresponseDeserialized = deserialize(
        completeaudienceactionresponse1.toArray(undefined));
    expect(completeaudienceactionresponseDeserialized.toArray(undefined)).to.deep.equal(
        completeaudienceactionresponse1.toArray(undefined));

    // Verify fields.
    expect(completeaudienceactionresponseDeserialized.getSwgUserToken()).to.deep.equal(
        completeaudienceactionresponse1.getSwgUserToken());
    expect(completeaudienceactionresponseDeserialized.getActionCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getActionCompleted());
    expect(completeaudienceactionresponseDeserialized.getUserEmail()).to.deep.equal(
        completeaudienceactionresponse1.getUserEmail());
    expect(completeaudienceactionresponseDeserialized.getAlreadyCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getAlreadyCompleted());

    // Verify includeLabel true
    // Verify serialized arrays.
    completeaudienceactionresponseDeserialized = deserialize(
        completeaudienceactionresponse1.toArray(true));
    expect(completeaudienceactionresponseDeserialized.toArray(true)).to.deep.equal(
        completeaudienceactionresponse1.toArray(true));

    // Verify fields.
    expect(completeaudienceactionresponseDeserialized.getSwgUserToken()).to.deep.equal(
        completeaudienceactionresponse1.getSwgUserToken());
    expect(completeaudienceactionresponseDeserialized.getActionCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getActionCompleted());
    expect(completeaudienceactionresponseDeserialized.getUserEmail()).to.deep.equal(
        completeaudienceactionresponse1.getUserEmail());
    expect(completeaudienceactionresponseDeserialized.getAlreadyCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getAlreadyCompleted());

    // Verify includeLabel false
    // Verify serialized arrays.
    completeaudienceactionresponseDeserialized = new CompleteAudienceActionResponse(completeaudienceactionresponse1.toArray(false), false);
    expect(completeaudienceactionresponseDeserialized.toArray(false)).to.deep.equal(
        completeaudienceactionresponse1.toArray(false));

    // Verify fields.
    expect(completeaudienceactionresponseDeserialized.getSwgUserToken()).to.deep.equal(
        completeaudienceactionresponse1.getSwgUserToken());
    expect(completeaudienceactionresponseDeserialized.getActionCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getActionCompleted());
    expect(completeaudienceactionresponseDeserialized.getUserEmail()).to.deep.equal(
        completeaudienceactionresponse1.getUserEmail());
    expect(completeaudienceactionresponseDeserialized.getAlreadyCompleted()).to.deep.equal(
        completeaudienceactionresponse1.getAlreadyCompleted());
  });
});

describe('EntitlementJwt', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementJwt  */ entitlementjwt1 = new EntitlementJwt();
    entitlementjwt1.setJwt('');
    entitlementjwt1.setSource('');

    let entitlementjwtDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementjwtDeserialized = deserialize(
        entitlementjwt1.toArray(undefined));
    expect(entitlementjwtDeserialized.toArray(undefined)).to.deep.equal(
        entitlementjwt1.toArray(undefined));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt1.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt1.getSource());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementjwtDeserialized = deserialize(
        entitlementjwt1.toArray(true));
    expect(entitlementjwtDeserialized.toArray(true)).to.deep.equal(
        entitlementjwt1.toArray(true));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt1.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt1.getSource());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementjwtDeserialized = new EntitlementJwt(entitlementjwt1.toArray(false), false);
    expect(entitlementjwtDeserialized.toArray(false)).to.deep.equal(
        entitlementjwt1.toArray(false));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt1.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt1.getSource());
  });
});

describe('EntitlementsRequest', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementsRequest  */ entitlementsrequest1 = new EntitlementsRequest();
    const /** !EntitlementJwt  */ entitlementjwt1 = new EntitlementJwt();
    entitlementjwt1.setJwt('');
    entitlementjwt1.setSource('');
    entitlementsrequest1.setUsedEntitlement(entitlementjwt1);
    const /** !Timestamp  */ timestamp1 = new Timestamp();
    timestamp1.setSeconds(0);
    timestamp1.setNanos(0);
    entitlementsrequest1.setClientEventTime(timestamp1);
    entitlementsrequest1.setEntitlementSource(EntitlementSource.UNKNOWN_ENTITLEMENT_SOURCE);
    entitlementsrequest1.setEntitlementResult(EntitlementResult.UNKNOWN_ENTITLEMENT_RESULT);
    entitlementsrequest1.setToken('');
    entitlementsrequest1.setIsUserRegistered(false);
    const /** !Timestamp  */ timestamp2 = new Timestamp();
    timestamp2.setSeconds(0);
    timestamp2.setNanos(0);
    entitlementsrequest1.setSubscriptionTimestamp(timestamp2);

    let entitlementsrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementsrequestDeserialized = deserialize(
        entitlementsrequest1.toArray(undefined));
    expect(entitlementsrequestDeserialized.toArray(undefined)).to.deep.equal(
        entitlementsrequest1.toArray(undefined));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest1.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest1.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest1.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest1.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest1.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest1.getIsUserRegistered());
    expect(entitlementsrequestDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        entitlementsrequest1.getSubscriptionTimestamp());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementsrequestDeserialized = deserialize(
        entitlementsrequest1.toArray(true));
    expect(entitlementsrequestDeserialized.toArray(true)).to.deep.equal(
        entitlementsrequest1.toArray(true));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest1.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest1.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest1.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest1.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest1.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest1.getIsUserRegistered());
    expect(entitlementsrequestDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        entitlementsrequest1.getSubscriptionTimestamp());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementsrequestDeserialized = new EntitlementsRequest(entitlementsrequest1.toArray(false), false);
    expect(entitlementsrequestDeserialized.toArray(false)).to.deep.equal(
        entitlementsrequest1.toArray(false));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest1.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest1.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest1.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest1.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest1.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest1.getIsUserRegistered());
    expect(entitlementsrequestDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        entitlementsrequest1.getSubscriptionTimestamp());
  });
});

describe('EntitlementsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementsResponse  */ entitlementsresponse1 = new EntitlementsResponse();
    entitlementsresponse1.setJwt('');
    entitlementsresponse1.setSwgUserToken('');

    let entitlementsresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementsresponseDeserialized = deserialize(
        entitlementsresponse1.toArray(undefined));
    expect(entitlementsresponseDeserialized.toArray(undefined)).to.deep.equal(
        entitlementsresponse1.toArray(undefined));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse1.getJwt());
    expect(entitlementsresponseDeserialized.getSwgUserToken()).to.deep.equal(
        entitlementsresponse1.getSwgUserToken());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementsresponseDeserialized = deserialize(
        entitlementsresponse1.toArray(true));
    expect(entitlementsresponseDeserialized.toArray(true)).to.deep.equal(
        entitlementsresponse1.toArray(true));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse1.getJwt());
    expect(entitlementsresponseDeserialized.getSwgUserToken()).to.deep.equal(
        entitlementsresponse1.getSwgUserToken());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementsresponseDeserialized = new EntitlementsResponse(entitlementsresponse1.toArray(false), false);
    expect(entitlementsresponseDeserialized.toArray(false)).to.deep.equal(
        entitlementsresponse1.toArray(false));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse1.getJwt());
    expect(entitlementsresponseDeserialized.getSwgUserToken()).to.deep.equal(
        entitlementsresponse1.getSwgUserToken());
  });
});

describe('EventParams', () => {
  it('should deserialize correctly', () => {
    const /** !EventParams  */ eventparams1 = new EventParams();
    eventparams1.setSmartboxMessage('');
    eventparams1.setGpayTransactionId('');
    eventparams1.setHadLogged(false);
    eventparams1.setSku('');
    eventparams1.setOldTransactionId('');
    eventparams1.setIsUserRegistered(false);
    eventparams1.setSubscriptionFlow('');
    const /** !Timestamp  */ timestamp1 = new Timestamp();
    timestamp1.setSeconds(0);
    timestamp1.setNanos(0);
    eventparams1.setSubscriptionTimestamp(timestamp1);

    let eventparamsDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    eventparamsDeserialized = deserialize(
        eventparams1.toArray(undefined));
    expect(eventparamsDeserialized.toArray(undefined)).to.deep.equal(
        eventparams1.toArray(undefined));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams1.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams1.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams1.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams1.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams1.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams1.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams1.getSubscriptionFlow());
    expect(eventparamsDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        eventparams1.getSubscriptionTimestamp());

    // Verify includeLabel true
    // Verify serialized arrays.
    eventparamsDeserialized = deserialize(
        eventparams1.toArray(true));
    expect(eventparamsDeserialized.toArray(true)).to.deep.equal(
        eventparams1.toArray(true));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams1.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams1.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams1.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams1.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams1.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams1.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams1.getSubscriptionFlow());
    expect(eventparamsDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        eventparams1.getSubscriptionTimestamp());

    // Verify includeLabel false
    // Verify serialized arrays.
    eventparamsDeserialized = new EventParams(eventparams1.toArray(false), false);
    expect(eventparamsDeserialized.toArray(false)).to.deep.equal(
        eventparams1.toArray(false));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams1.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams1.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams1.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams1.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams1.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams1.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams1.getSubscriptionFlow());
    expect(eventparamsDeserialized.getSubscriptionTimestamp()).to.deep.equal(
        eventparams1.getSubscriptionTimestamp());
  });
});

describe('FinishedLoggingResponse', () => {
  it('should deserialize correctly', () => {
    const /** !FinishedLoggingResponse  */ finishedloggingresponse1 = new FinishedLoggingResponse();
    finishedloggingresponse1.setComplete(false);
    finishedloggingresponse1.setError('');

    let finishedloggingresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = deserialize(
        finishedloggingresponse1.toArray(undefined));
    expect(finishedloggingresponseDeserialized.toArray(undefined)).to.deep.equal(
        finishedloggingresponse1.toArray(undefined));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse1.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse1.getError());

    // Verify includeLabel true
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = deserialize(
        finishedloggingresponse1.toArray(true));
    expect(finishedloggingresponseDeserialized.toArray(true)).to.deep.equal(
        finishedloggingresponse1.toArray(true));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse1.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse1.getError());

    // Verify includeLabel false
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = new FinishedLoggingResponse(finishedloggingresponse1.toArray(false), false);
    expect(finishedloggingresponseDeserialized.toArray(false)).to.deep.equal(
        finishedloggingresponse1.toArray(false));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse1.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse1.getError());
  });
});

describe('LinkSaveTokenRequest', () => {
  it('should deserialize correctly', () => {
    const /** !LinkSaveTokenRequest  */ linksavetokenrequest1 = new LinkSaveTokenRequest();
    linksavetokenrequest1.setAuthCode('');
    linksavetokenrequest1.setToken('');

    let linksavetokenrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = deserialize(
        linksavetokenrequest1.toArray(undefined));
    expect(linksavetokenrequestDeserialized.toArray(undefined)).to.deep.equal(
        linksavetokenrequest1.toArray(undefined));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest1.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest1.getToken());

    // Verify includeLabel true
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = deserialize(
        linksavetokenrequest1.toArray(true));
    expect(linksavetokenrequestDeserialized.toArray(true)).to.deep.equal(
        linksavetokenrequest1.toArray(true));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest1.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest1.getToken());

    // Verify includeLabel false
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = new LinkSaveTokenRequest(linksavetokenrequest1.toArray(false), false);
    expect(linksavetokenrequestDeserialized.toArray(false)).to.deep.equal(
        linksavetokenrequest1.toArray(false));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest1.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest1.getToken());
  });
});

describe('LinkingInfoResponse', () => {
  it('should deserialize correctly', () => {
    const /** !LinkingInfoResponse  */ linkinginforesponse1 = new LinkingInfoResponse();
    linkinginforesponse1.setRequested(false);

    let linkinginforesponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    linkinginforesponseDeserialized = deserialize(
        linkinginforesponse1.toArray(undefined));
    expect(linkinginforesponseDeserialized.toArray(undefined)).to.deep.equal(
        linkinginforesponse1.toArray(undefined));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse1.getRequested());

    // Verify includeLabel true
    // Verify serialized arrays.
    linkinginforesponseDeserialized = deserialize(
        linkinginforesponse1.toArray(true));
    expect(linkinginforesponseDeserialized.toArray(true)).to.deep.equal(
        linkinginforesponse1.toArray(true));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse1.getRequested());

    // Verify includeLabel false
    // Verify serialized arrays.
    linkinginforesponseDeserialized = new LinkingInfoResponse(linkinginforesponse1.toArray(false), false);
    expect(linkinginforesponseDeserialized.toArray(false)).to.deep.equal(
        linkinginforesponse1.toArray(false));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse1.getRequested());
  });
});

describe('OpenDialogRequest', () => {
  it('should deserialize correctly', () => {
    const /** !OpenDialogRequest  */ opendialogrequest1 = new OpenDialogRequest();
    opendialogrequest1.setUrlPath('');

    let opendialogrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    opendialogrequestDeserialized = deserialize(
        opendialogrequest1.toArray(undefined));
    expect(opendialogrequestDeserialized.toArray(undefined)).to.deep.equal(
        opendialogrequest1.toArray(undefined));

    // Verify fields.
    expect(opendialogrequestDeserialized.getUrlPath()).to.deep.equal(
        opendialogrequest1.getUrlPath());

    // Verify includeLabel true
    // Verify serialized arrays.
    opendialogrequestDeserialized = deserialize(
        opendialogrequest1.toArray(true));
    expect(opendialogrequestDeserialized.toArray(true)).to.deep.equal(
        opendialogrequest1.toArray(true));

    // Verify fields.
    expect(opendialogrequestDeserialized.getUrlPath()).to.deep.equal(
        opendialogrequest1.getUrlPath());

    // Verify includeLabel false
    // Verify serialized arrays.
    opendialogrequestDeserialized = new OpenDialogRequest(opendialogrequest1.toArray(false), false);
    expect(opendialogrequestDeserialized.toArray(false)).to.deep.equal(
        opendialogrequest1.toArray(false));

    // Verify fields.
    expect(opendialogrequestDeserialized.getUrlPath()).to.deep.equal(
        opendialogrequest1.getUrlPath());
  });
});

describe('SkuSelectedResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SkuSelectedResponse  */ skuselectedresponse1 = new SkuSelectedResponse();
    skuselectedresponse1.setSku('');
    skuselectedresponse1.setOldSku('');
    skuselectedresponse1.setOneTime(false);
    skuselectedresponse1.setPlayOffer('');
    skuselectedresponse1.setOldPlayOffer('');
    skuselectedresponse1.setCustomMessage('');
    skuselectedresponse1.setAnonymous(false);
    skuselectedresponse1.setSharingPolicyEnabled(false);

    let skuselectedresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    skuselectedresponseDeserialized = deserialize(
        skuselectedresponse1.toArray(undefined));
    expect(skuselectedresponseDeserialized.toArray(undefined)).to.deep.equal(
        skuselectedresponse1.toArray(undefined));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse1.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse1.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse1.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse1.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse1.getOldPlayOffer());
    expect(skuselectedresponseDeserialized.getCustomMessage()).to.deep.equal(
        skuselectedresponse1.getCustomMessage());
    expect(skuselectedresponseDeserialized.getAnonymous()).to.deep.equal(
        skuselectedresponse1.getAnonymous());
    expect(skuselectedresponseDeserialized.getSharingPolicyEnabled()).to.deep.equal(
        skuselectedresponse1.getSharingPolicyEnabled());

    // Verify includeLabel true
    // Verify serialized arrays.
    skuselectedresponseDeserialized = deserialize(
        skuselectedresponse1.toArray(true));
    expect(skuselectedresponseDeserialized.toArray(true)).to.deep.equal(
        skuselectedresponse1.toArray(true));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse1.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse1.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse1.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse1.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse1.getOldPlayOffer());
    expect(skuselectedresponseDeserialized.getCustomMessage()).to.deep.equal(
        skuselectedresponse1.getCustomMessage());
    expect(skuselectedresponseDeserialized.getAnonymous()).to.deep.equal(
        skuselectedresponse1.getAnonymous());
    expect(skuselectedresponseDeserialized.getSharingPolicyEnabled()).to.deep.equal(
        skuselectedresponse1.getSharingPolicyEnabled());

    // Verify includeLabel false
    // Verify serialized arrays.
    skuselectedresponseDeserialized = new SkuSelectedResponse(skuselectedresponse1.toArray(false), false);
    expect(skuselectedresponseDeserialized.toArray(false)).to.deep.equal(
        skuselectedresponse1.toArray(false));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse1.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse1.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse1.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse1.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse1.getOldPlayOffer());
    expect(skuselectedresponseDeserialized.getCustomMessage()).to.deep.equal(
        skuselectedresponse1.getCustomMessage());
    expect(skuselectedresponseDeserialized.getAnonymous()).to.deep.equal(
        skuselectedresponse1.getAnonymous());
    expect(skuselectedresponseDeserialized.getSharingPolicyEnabled()).to.deep.equal(
        skuselectedresponse1.getSharingPolicyEnabled());
  });
});

describe('SmartBoxMessage', () => {
  it('should deserialize correctly', () => {
    const /** !SmartBoxMessage  */ smartboxmessage1 = new SmartBoxMessage();
    smartboxmessage1.setIsClicked(false);

    let smartboxmessageDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    smartboxmessageDeserialized = deserialize(
        smartboxmessage1.toArray(undefined));
    expect(smartboxmessageDeserialized.toArray(undefined)).to.deep.equal(
        smartboxmessage1.toArray(undefined));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage1.getIsClicked());

    // Verify includeLabel true
    // Verify serialized arrays.
    smartboxmessageDeserialized = deserialize(
        smartboxmessage1.toArray(true));
    expect(smartboxmessageDeserialized.toArray(true)).to.deep.equal(
        smartboxmessage1.toArray(true));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage1.getIsClicked());

    // Verify includeLabel false
    // Verify serialized arrays.
    smartboxmessageDeserialized = new SmartBoxMessage(smartboxmessage1.toArray(false), false);
    expect(smartboxmessageDeserialized.toArray(false)).to.deep.equal(
        smartboxmessage1.toArray(false));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage1.getIsClicked());
  });
});

describe('SubscribeResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SubscribeResponse  */ subscriberesponse1 = new SubscribeResponse();
    subscriberesponse1.setSubscribe(false);

    let subscriberesponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    subscriberesponseDeserialized = deserialize(
        subscriberesponse1.toArray(undefined));
    expect(subscriberesponseDeserialized.toArray(undefined)).to.deep.equal(
        subscriberesponse1.toArray(undefined));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse1.getSubscribe());

    // Verify includeLabel true
    // Verify serialized arrays.
    subscriberesponseDeserialized = deserialize(
        subscriberesponse1.toArray(true));
    expect(subscriberesponseDeserialized.toArray(true)).to.deep.equal(
        subscriberesponse1.toArray(true));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse1.getSubscribe());

    // Verify includeLabel false
    // Verify serialized arrays.
    subscriberesponseDeserialized = new SubscribeResponse(subscriberesponse1.toArray(false), false);
    expect(subscriberesponseDeserialized.toArray(false)).to.deep.equal(
        subscriberesponse1.toArray(false));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse1.getSubscribe());
  });
});

describe('SubscriptionLinkingCompleteResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SubscriptionLinkingCompleteResponse  */ subscriptionlinkingcompleteresponse1 = new SubscriptionLinkingCompleteResponse();
    subscriptionlinkingcompleteresponse1.setPublisherProvidedId('');

    let subscriptionlinkingcompleteresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    subscriptionlinkingcompleteresponseDeserialized = deserialize(
        subscriptionlinkingcompleteresponse1.toArray(undefined));
    expect(subscriptionlinkingcompleteresponseDeserialized.toArray(undefined)).to.deep.equal(
        subscriptionlinkingcompleteresponse1.toArray(undefined));

    // Verify fields.
    expect(subscriptionlinkingcompleteresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingcompleteresponse1.getPublisherProvidedId());

    // Verify includeLabel true
    // Verify serialized arrays.
    subscriptionlinkingcompleteresponseDeserialized = deserialize(
        subscriptionlinkingcompleteresponse1.toArray(true));
    expect(subscriptionlinkingcompleteresponseDeserialized.toArray(true)).to.deep.equal(
        subscriptionlinkingcompleteresponse1.toArray(true));

    // Verify fields.
    expect(subscriptionlinkingcompleteresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingcompleteresponse1.getPublisherProvidedId());

    // Verify includeLabel false
    // Verify serialized arrays.
    subscriptionlinkingcompleteresponseDeserialized = new SubscriptionLinkingCompleteResponse(subscriptionlinkingcompleteresponse1.toArray(false), false);
    expect(subscriptionlinkingcompleteresponseDeserialized.toArray(false)).to.deep.equal(
        subscriptionlinkingcompleteresponse1.toArray(false));

    // Verify fields.
    expect(subscriptionlinkingcompleteresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingcompleteresponse1.getPublisherProvidedId());
  });
});

describe('SubscriptionLinkingResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SubscriptionLinkingResponse  */ subscriptionlinkingresponse1 = new SubscriptionLinkingResponse();
    subscriptionlinkingresponse1.setPublisherProvidedId('');

    let subscriptionlinkingresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    subscriptionlinkingresponseDeserialized = deserialize(
        subscriptionlinkingresponse1.toArray(undefined));
    expect(subscriptionlinkingresponseDeserialized.toArray(undefined)).to.deep.equal(
        subscriptionlinkingresponse1.toArray(undefined));

    // Verify fields.
    expect(subscriptionlinkingresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingresponse1.getPublisherProvidedId());

    // Verify includeLabel true
    // Verify serialized arrays.
    subscriptionlinkingresponseDeserialized = deserialize(
        subscriptionlinkingresponse1.toArray(true));
    expect(subscriptionlinkingresponseDeserialized.toArray(true)).to.deep.equal(
        subscriptionlinkingresponse1.toArray(true));

    // Verify fields.
    expect(subscriptionlinkingresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingresponse1.getPublisherProvidedId());

    // Verify includeLabel false
    // Verify serialized arrays.
    subscriptionlinkingresponseDeserialized = new SubscriptionLinkingResponse(subscriptionlinkingresponse1.toArray(false), false);
    expect(subscriptionlinkingresponseDeserialized.toArray(false)).to.deep.equal(
        subscriptionlinkingresponse1.toArray(false));

    // Verify fields.
    expect(subscriptionlinkingresponseDeserialized.getPublisherProvidedId()).to.deep.equal(
        subscriptionlinkingresponse1.getPublisherProvidedId());
  });
});

describe('SurveyAnswer', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyAnswer  */ surveyanswer1 = new SurveyAnswer();
    surveyanswer1.setAnswerId(0);
    surveyanswer1.setAnswerText('');
    surveyanswer1.setAnswerCategory('');

    let surveyanswerDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveyanswerDeserialized = deserialize(
        surveyanswer1.toArray(undefined));
    expect(surveyanswerDeserialized.toArray(undefined)).to.deep.equal(
        surveyanswer1.toArray(undefined));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer1.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer1.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer1.getAnswerCategory());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveyanswerDeserialized = deserialize(
        surveyanswer1.toArray(true));
    expect(surveyanswerDeserialized.toArray(true)).to.deep.equal(
        surveyanswer1.toArray(true));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer1.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer1.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer1.getAnswerCategory());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveyanswerDeserialized = new SurveyAnswer(surveyanswer1.toArray(false), false);
    expect(surveyanswerDeserialized.toArray(false)).to.deep.equal(
        surveyanswer1.toArray(false));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer1.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer1.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer1.getAnswerCategory());
  });
});

describe('SurveyDataTransferRequest', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyDataTransferRequest  */ surveydatatransferrequest1 = new SurveyDataTransferRequest();
    surveydatatransferrequest1.setSurveyQuestionsList([]);

    let surveydatatransferrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = deserialize(
        surveydatatransferrequest1.toArray(undefined));
    expect(surveydatatransferrequestDeserialized.toArray(undefined)).to.deep.equal(
        surveydatatransferrequest1.toArray(undefined));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest1.getSurveyQuestionsList());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = deserialize(
        surveydatatransferrequest1.toArray(true));
    expect(surveydatatransferrequestDeserialized.toArray(true)).to.deep.equal(
        surveydatatransferrequest1.toArray(true));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest1.getSurveyQuestionsList());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = new SurveyDataTransferRequest(surveydatatransferrequest1.toArray(false), false);
    expect(surveydatatransferrequestDeserialized.toArray(false)).to.deep.equal(
        surveydatatransferrequest1.toArray(false));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest1.getSurveyQuestionsList());
  });
});

describe('SurveyDataTransferResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyDataTransferResponse  */ surveydatatransferresponse1 = new SurveyDataTransferResponse();
    surveydatatransferresponse1.setSuccess(false);

    let surveydatatransferresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = deserialize(
        surveydatatransferresponse1.toArray(undefined));
    expect(surveydatatransferresponseDeserialized.toArray(undefined)).to.deep.equal(
        surveydatatransferresponse1.toArray(undefined));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse1.getSuccess());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = deserialize(
        surveydatatransferresponse1.toArray(true));
    expect(surveydatatransferresponseDeserialized.toArray(true)).to.deep.equal(
        surveydatatransferresponse1.toArray(true));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse1.getSuccess());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = new SurveyDataTransferResponse(surveydatatransferresponse1.toArray(false), false);
    expect(surveydatatransferresponseDeserialized.toArray(false)).to.deep.equal(
        surveydatatransferresponse1.toArray(false));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse1.getSuccess());
  });
});

describe('SurveyQuestion', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyQuestion  */ surveyquestion1 = new SurveyQuestion();
    surveyquestion1.setQuestionId(0);
    surveyquestion1.setQuestionText('');
    surveyquestion1.setQuestionCategory('');
    surveyquestion1.setSurveyAnswersList([]);

    let surveyquestionDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveyquestionDeserialized = deserialize(
        surveyquestion1.toArray(undefined));
    expect(surveyquestionDeserialized.toArray(undefined)).to.deep.equal(
        surveyquestion1.toArray(undefined));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion1.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion1.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion1.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion1.getSurveyAnswersList());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveyquestionDeserialized = deserialize(
        surveyquestion1.toArray(true));
    expect(surveyquestionDeserialized.toArray(true)).to.deep.equal(
        surveyquestion1.toArray(true));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion1.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion1.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion1.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion1.getSurveyAnswersList());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveyquestionDeserialized = new SurveyQuestion(surveyquestion1.toArray(false), false);
    expect(surveyquestionDeserialized.toArray(false)).to.deep.equal(
        surveyquestion1.toArray(false));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion1.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion1.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion1.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion1.getSurveyAnswersList());
  });
});

describe('SurveyAnswer', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyAnswer  */ surveyanswer = new SurveyAnswer();
    surveyanswer.setAnswerId(0);
    surveyanswer.setAnswerText('');
    surveyanswer.setAnswerCategory('');

    let surveyanswerDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveyanswerDeserialized = deserialize(
        surveyanswer.toArray(undefined));
    expect(surveyanswerDeserialized.toArray(undefined)).to.deep.equal(
        surveyanswer.toArray(undefined));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer.getAnswerCategory());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveyanswerDeserialized = deserialize(
        surveyanswer.toArray(true));
    expect(surveyanswerDeserialized.toArray(true)).to.deep.equal(
        surveyanswer.toArray(true));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer.getAnswerCategory());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveyanswerDeserialized = new SurveyAnswer(surveyanswer.toArray(false), false);
    expect(surveyanswerDeserialized.toArray(false)).to.deep.equal(
        surveyanswer.toArray(false));

    // Verify fields.
    expect(surveyanswerDeserialized.getAnswerId()).to.deep.equal(
        surveyanswer.getAnswerId());
    expect(surveyanswerDeserialized.getAnswerText()).to.deep.equal(
        surveyanswer.getAnswerText());
    expect(surveyanswerDeserialized.getAnswerCategory()).to.deep.equal(
        surveyanswer.getAnswerCategory());
  });
});

describe('SurveyDataTransferRequest', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyDataTransferRequest  */ surveydatatransferrequest = new SurveyDataTransferRequest();
    surveydatatransferrequest.setSurveyQuestionsList([]);

    let surveydatatransferrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = deserialize(
        surveydatatransferrequest.toArray(undefined));
    expect(surveydatatransferrequestDeserialized.toArray(undefined)).to.deep.equal(
        surveydatatransferrequest.toArray(undefined));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest.getSurveyQuestionsList());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = deserialize(
        surveydatatransferrequest.toArray(true));
    expect(surveydatatransferrequestDeserialized.toArray(true)).to.deep.equal(
        surveydatatransferrequest.toArray(true));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest.getSurveyQuestionsList());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveydatatransferrequestDeserialized = new SurveyDataTransferRequest(surveydatatransferrequest.toArray(false), false);
    expect(surveydatatransferrequestDeserialized.toArray(false)).to.deep.equal(
        surveydatatransferrequest.toArray(false));

    // Verify fields.
    expect(surveydatatransferrequestDeserialized.getSurveyQuestionsList()).to.deep.equal(
        surveydatatransferrequest.getSurveyQuestionsList());
  });
});

describe('SurveyDataTransferResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyDataTransferResponse  */ surveydatatransferresponse = new SurveyDataTransferResponse();
    surveydatatransferresponse.setSuccess(false);

    let surveydatatransferresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = deserialize(
        surveydatatransferresponse.toArray(undefined));
    expect(surveydatatransferresponseDeserialized.toArray(undefined)).to.deep.equal(
        surveydatatransferresponse.toArray(undefined));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse.getSuccess());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = deserialize(
        surveydatatransferresponse.toArray(true));
    expect(surveydatatransferresponseDeserialized.toArray(true)).to.deep.equal(
        surveydatatransferresponse.toArray(true));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse.getSuccess());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveydatatransferresponseDeserialized = new SurveyDataTransferResponse(surveydatatransferresponse.toArray(false), false);
    expect(surveydatatransferresponseDeserialized.toArray(false)).to.deep.equal(
        surveydatatransferresponse.toArray(false));

    // Verify fields.
    expect(surveydatatransferresponseDeserialized.getSuccess()).to.deep.equal(
        surveydatatransferresponse.getSuccess());
  });
});

describe('SurveyQuestion', () => {
  it('should deserialize correctly', () => {
    const /** !SurveyQuestion  */ surveyquestion = new SurveyQuestion();
    surveyquestion.setQuestionId(0);
    surveyquestion.setQuestionText('');
    surveyquestion.setQuestionCategory('');
    surveyquestion.setSurveyAnswersList([]);

    let surveyquestionDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    surveyquestionDeserialized = deserialize(
        surveyquestion.toArray(undefined));
    expect(surveyquestionDeserialized.toArray(undefined)).to.deep.equal(
        surveyquestion.toArray(undefined));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion.getSurveyAnswersList());

    // Verify includeLabel true
    // Verify serialized arrays.
    surveyquestionDeserialized = deserialize(
        surveyquestion.toArray(true));
    expect(surveyquestionDeserialized.toArray(true)).to.deep.equal(
        surveyquestion.toArray(true));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion.getSurveyAnswersList());

    // Verify includeLabel false
    // Verify serialized arrays.
    surveyquestionDeserialized = new SurveyQuestion(surveyquestion.toArray(false), false);
    expect(surveyquestionDeserialized.toArray(false)).to.deep.equal(
        surveyquestion.toArray(false));

    // Verify fields.
    expect(surveyquestionDeserialized.getQuestionId()).to.deep.equal(
        surveyquestion.getQuestionId());
    expect(surveyquestionDeserialized.getQuestionText()).to.deep.equal(
        surveyquestion.getQuestionText());
    expect(surveyquestionDeserialized.getQuestionCategory()).to.deep.equal(
        surveyquestion.getQuestionCategory());
    expect(surveyquestionDeserialized.getSurveyAnswersList()).to.deep.equal(
        surveyquestion.getSurveyAnswersList());
  });
});

describe('Timestamp', () => {
  it('should deserialize correctly', () => {
    const /** !Timestamp  */ timestamp1 = new Timestamp();
    timestamp1.setSeconds(0);
    timestamp1.setNanos(0);

    let timestampDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    timestampDeserialized = deserialize(
        timestamp1.toArray(undefined));
    expect(timestampDeserialized.toArray(undefined)).to.deep.equal(
        timestamp1.toArray(undefined));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp1.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp1.getNanos());

    // Verify includeLabel true
    // Verify serialized arrays.
    timestampDeserialized = deserialize(
        timestamp1.toArray(true));
    expect(timestampDeserialized.toArray(true)).to.deep.equal(
        timestamp1.toArray(true));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp1.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp1.getNanos());

    // Verify includeLabel false
    // Verify serialized arrays.
    timestampDeserialized = new Timestamp(timestamp1.toArray(false), false);
    expect(timestampDeserialized.toArray(false)).to.deep.equal(
        timestamp1.toArray(false));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp1.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp1.getNanos());
  });
});

describe('ToastCloseRequest', () => {
  it('should deserialize correctly', () => {
    const /** !ToastCloseRequest  */ toastcloserequest1 = new ToastCloseRequest();
    toastcloserequest1.setClose(false);

    let toastcloserequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    toastcloserequestDeserialized = deserialize(
        toastcloserequest1.toArray(undefined));
    expect(toastcloserequestDeserialized.toArray(undefined)).to.deep.equal(
        toastcloserequest1.toArray(undefined));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest1.getClose());

    // Verify includeLabel true
    // Verify serialized arrays.
    toastcloserequestDeserialized = deserialize(
        toastcloserequest1.toArray(true));
    expect(toastcloserequestDeserialized.toArray(true)).to.deep.equal(
        toastcloserequest1.toArray(true));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest1.getClose());

    // Verify includeLabel false
    // Verify serialized arrays.
    toastcloserequestDeserialized = new ToastCloseRequest(toastcloserequest1.toArray(false), false);
    expect(toastcloserequestDeserialized.toArray(false)).to.deep.equal(
        toastcloserequest1.toArray(false));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest1.getClose());
  });
});

describe('ViewSubscriptionsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !ViewSubscriptionsResponse  */ viewsubscriptionsresponse1 = new ViewSubscriptionsResponse();
    viewsubscriptionsresponse1.setNative(false);

    let viewsubscriptionsresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = deserialize(
        viewsubscriptionsresponse1.toArray(undefined));
    expect(viewsubscriptionsresponseDeserialized.toArray(undefined)).to.deep.equal(
        viewsubscriptionsresponse1.toArray(undefined));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse1.getNative());

    // Verify includeLabel true
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = deserialize(
        viewsubscriptionsresponse1.toArray(true));
    expect(viewsubscriptionsresponseDeserialized.toArray(true)).to.deep.equal(
        viewsubscriptionsresponse1.toArray(true));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse1.getNative());

    // Verify includeLabel false
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = new ViewSubscriptionsResponse(viewsubscriptionsresponse1.toArray(false), false);
    expect(viewsubscriptionsresponseDeserialized.toArray(false)).to.deep.equal(
        viewsubscriptionsresponse1.toArray(false));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse1.getNative());
  });
});
