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

import {AccountCreationRequest, AlreadySubscribedResponse, AnalyticsContext, AnalyticsEvent, AnalyticsEventMeta, AnalyticsRequest, EntitlementJwt, EntitlementResult, EntitlementSource, EntitlementsRequest, EntitlementsResponse, EventOriginator, EventParams, FinishedLoggingResponse, LinkSaveTokenRequest, LinkingInfoResponse, SkuSelectedResponse, SmartBoxMessage, SubscribeResponse, Timestamp, ToastCloseRequest, ViewSubscriptionsResponse, deserialize, getLabel} from './api_messages';

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
    const /** !AccountCreationRequest  */ accountcreationrequest = new AccountCreationRequest();
    accountcreationrequest.setComplete(false);

    let accountcreationrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    accountcreationrequestDeserialized = deserialize(
        accountcreationrequest.toArray(undefined));
    expect(accountcreationrequestDeserialized.toArray(undefined)).to.deep.equal(
        accountcreationrequest.toArray(undefined));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest.getComplete());

    // Verify includeLabel true
    // Verify serialized arrays.
    accountcreationrequestDeserialized = deserialize(
        accountcreationrequest.toArray(true));
    expect(accountcreationrequestDeserialized.toArray(true)).to.deep.equal(
        accountcreationrequest.toArray(true));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest.getComplete());

    // Verify includeLabel false
    // Verify serialized arrays.
    accountcreationrequestDeserialized = new AccountCreationRequest(accountcreationrequest.toArray(false), false);
    expect(accountcreationrequestDeserialized.toArray(false)).to.deep.equal(
        accountcreationrequest.toArray(false));

    // Verify fields.
    expect(accountcreationrequestDeserialized.getComplete()).to.deep.equal(
        accountcreationrequest.getComplete());
  });
});

describe('AlreadySubscribedResponse', () => {
  it('should deserialize correctly', () => {
    const /** !AlreadySubscribedResponse  */ alreadysubscribedresponse = new AlreadySubscribedResponse();
    alreadysubscribedresponse.setSubscriberOrMember(false);
    alreadysubscribedresponse.setLinkRequested(false);

    let alreadysubscribedresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = deserialize(
        alreadysubscribedresponse.toArray(undefined));
    expect(alreadysubscribedresponseDeserialized.toArray(undefined)).to.deep.equal(
        alreadysubscribedresponse.toArray(undefined));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse.getLinkRequested());

    // Verify includeLabel true
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = deserialize(
        alreadysubscribedresponse.toArray(true));
    expect(alreadysubscribedresponseDeserialized.toArray(true)).to.deep.equal(
        alreadysubscribedresponse.toArray(true));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse.getLinkRequested());

    // Verify includeLabel false
    // Verify serialized arrays.
    alreadysubscribedresponseDeserialized = new AlreadySubscribedResponse(alreadysubscribedresponse.toArray(false), false);
    expect(alreadysubscribedresponseDeserialized.toArray(false)).to.deep.equal(
        alreadysubscribedresponse.toArray(false));

    // Verify fields.
    expect(alreadysubscribedresponseDeserialized.getSubscriberOrMember()).to.deep.equal(
        alreadysubscribedresponse.getSubscriberOrMember());
    expect(alreadysubscribedresponseDeserialized.getLinkRequested()).to.deep.equal(
        alreadysubscribedresponse.getLinkRequested());
  });
});

describe('AnalyticsContext', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsContext  */ analyticscontext = new AnalyticsContext();
    analyticscontext.setEmbedderOrigin('');
    analyticscontext.setTransactionId('');
    analyticscontext.setReferringOrigin('');
    analyticscontext.setUtmSource('');
    analyticscontext.setUtmCampaign('');
    analyticscontext.setUtmMedium('');
    analyticscontext.setSku('');
    analyticscontext.setReadyToPay(false);
    analyticscontext.setLabelList([]);
    analyticscontext.setClientVersion('');
    analyticscontext.setUrl('');

    let analyticscontextDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticscontextDeserialized = deserialize(
        analyticscontext.toArray(undefined));
    expect(analyticscontextDeserialized.toArray(undefined)).to.deep.equal(
        analyticscontext.toArray(undefined));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext.getUrl());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticscontextDeserialized = deserialize(
        analyticscontext.toArray(true));
    expect(analyticscontextDeserialized.toArray(true)).to.deep.equal(
        analyticscontext.toArray(true));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext.getUrl());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticscontextDeserialized = new AnalyticsContext(analyticscontext.toArray(false), false);
    expect(analyticscontextDeserialized.toArray(false)).to.deep.equal(
        analyticscontext.toArray(false));

    // Verify fields.
    expect(analyticscontextDeserialized.getEmbedderOrigin()).to.deep.equal(
        analyticscontext.getEmbedderOrigin());
    expect(analyticscontextDeserialized.getTransactionId()).to.deep.equal(
        analyticscontext.getTransactionId());
    expect(analyticscontextDeserialized.getReferringOrigin()).to.deep.equal(
        analyticscontext.getReferringOrigin());
    expect(analyticscontextDeserialized.getUtmSource()).to.deep.equal(
        analyticscontext.getUtmSource());
    expect(analyticscontextDeserialized.getUtmCampaign()).to.deep.equal(
        analyticscontext.getUtmCampaign());
    expect(analyticscontextDeserialized.getUtmMedium()).to.deep.equal(
        analyticscontext.getUtmMedium());
    expect(analyticscontextDeserialized.getSku()).to.deep.equal(
        analyticscontext.getSku());
    expect(analyticscontextDeserialized.getReadyToPay()).to.deep.equal(
        analyticscontext.getReadyToPay());
    expect(analyticscontextDeserialized.getLabelList()).to.deep.equal(
        analyticscontext.getLabelList());
    expect(analyticscontextDeserialized.getClientVersion()).to.deep.equal(
        analyticscontext.getClientVersion());
    expect(analyticscontextDeserialized.getUrl()).to.deep.equal(
        analyticscontext.getUrl());
  });
});

describe('AnalyticsEventMeta', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsEventMeta  */ analyticseventmeta = new AnalyticsEventMeta();
    analyticseventmeta.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
    analyticseventmeta.setIsFromUserAction(false);

    let analyticseventmetaDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticseventmetaDeserialized = deserialize(
        analyticseventmeta.toArray(undefined));
    expect(analyticseventmetaDeserialized.toArray(undefined)).to.deep.equal(
        analyticseventmeta.toArray(undefined));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta.getIsFromUserAction());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticseventmetaDeserialized = deserialize(
        analyticseventmeta.toArray(true));
    expect(analyticseventmetaDeserialized.toArray(true)).to.deep.equal(
        analyticseventmeta.toArray(true));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta.getIsFromUserAction());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticseventmetaDeserialized = new AnalyticsEventMeta(analyticseventmeta.toArray(false), false);
    expect(analyticseventmetaDeserialized.toArray(false)).to.deep.equal(
        analyticseventmeta.toArray(false));

    // Verify fields.
    expect(analyticseventmetaDeserialized.getEventOriginator()).to.deep.equal(
        analyticseventmeta.getEventOriginator());
    expect(analyticseventmetaDeserialized.getIsFromUserAction()).to.deep.equal(
        analyticseventmeta.getIsFromUserAction());
  });
});

describe('AnalyticsRequest', () => {
  it('should deserialize correctly', () => {
    const /** !AnalyticsRequest  */ analyticsrequest = new AnalyticsRequest();
    const /** !AnalyticsContext  */ analyticscontext = new AnalyticsContext();
    analyticscontext.setEmbedderOrigin('');
    analyticscontext.setTransactionId('');
    analyticscontext.setReferringOrigin('');
    analyticscontext.setUtmSource('');
    analyticscontext.setUtmCampaign('');
    analyticscontext.setUtmMedium('');
    analyticscontext.setSku('');
    analyticscontext.setReadyToPay(false);
    analyticscontext.setLabelList([]);
    analyticscontext.setClientVersion('');
    analyticscontext.setUrl('');
    analyticsrequest.setContext(analyticscontext);
    analyticsrequest.setEvent(AnalyticsEvent.UNKNOWN);
    const /** !AnalyticsEventMeta  */ analyticseventmeta = new AnalyticsEventMeta();
    analyticseventmeta.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
    analyticseventmeta.setIsFromUserAction(false);
    analyticsrequest.setMeta(analyticseventmeta);
    const /** !EventParams  */ eventparams = new EventParams();
    eventparams.setSmartboxMessage('');
    eventparams.setGpayTransactionId('');
    eventparams.setHadLogged(false);
    eventparams.setSku('');
    eventparams.setOldTransactionId('');
    eventparams.setIsUserRegistered(false);
    eventparams.setSubscriptionFlow('');
    analyticsrequest.setParams(eventparams);

    let analyticsrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    analyticsrequestDeserialized = deserialize(
        analyticsrequest.toArray(undefined));
    expect(analyticsrequestDeserialized.toArray(undefined)).to.deep.equal(
        analyticsrequest.toArray(undefined));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest.getParams());

    // Verify includeLabel true
    // Verify serialized arrays.
    analyticsrequestDeserialized = deserialize(
        analyticsrequest.toArray(true));
    expect(analyticsrequestDeserialized.toArray(true)).to.deep.equal(
        analyticsrequest.toArray(true));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest.getParams());

    // Verify includeLabel false
    // Verify serialized arrays.
    analyticsrequestDeserialized = new AnalyticsRequest(analyticsrequest.toArray(false), false);
    expect(analyticsrequestDeserialized.toArray(false)).to.deep.equal(
        analyticsrequest.toArray(false));

    // Verify fields.
    expect(analyticsrequestDeserialized.getContext()).to.deep.equal(
        analyticsrequest.getContext());
    expect(analyticsrequestDeserialized.getEvent()).to.deep.equal(
        analyticsrequest.getEvent());
    expect(analyticsrequestDeserialized.getMeta()).to.deep.equal(
        analyticsrequest.getMeta());
    expect(analyticsrequestDeserialized.getParams()).to.deep.equal(
        analyticsrequest.getParams());
  });
});

describe('EntitlementJwt', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementJwt  */ entitlementjwt = new EntitlementJwt();
    entitlementjwt.setJwt('');
    entitlementjwt.setSource('');

    let entitlementjwtDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementjwtDeserialized = deserialize(
        entitlementjwt.toArray(undefined));
    expect(entitlementjwtDeserialized.toArray(undefined)).to.deep.equal(
        entitlementjwt.toArray(undefined));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt.getSource());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementjwtDeserialized = deserialize(
        entitlementjwt.toArray(true));
    expect(entitlementjwtDeserialized.toArray(true)).to.deep.equal(
        entitlementjwt.toArray(true));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt.getSource());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementjwtDeserialized = new EntitlementJwt(entitlementjwt.toArray(false), false);
    expect(entitlementjwtDeserialized.toArray(false)).to.deep.equal(
        entitlementjwt.toArray(false));

    // Verify fields.
    expect(entitlementjwtDeserialized.getJwt()).to.deep.equal(
        entitlementjwt.getJwt());
    expect(entitlementjwtDeserialized.getSource()).to.deep.equal(
        entitlementjwt.getSource());
  });
});

describe('EntitlementsRequest', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementsRequest  */ entitlementsrequest = new EntitlementsRequest();
    const /** !EntitlementJwt  */ entitlementjwt = new EntitlementJwt();
    entitlementjwt.setJwt('');
    entitlementjwt.setSource('');
    entitlementsrequest.setUsedEntitlement(entitlementjwt);
    const /** !Timestamp  */ timestamp = new Timestamp();
    timestamp.setSeconds(0);
    timestamp.setNanos(0);
    entitlementsrequest.setClientEventTime(timestamp);
    entitlementsrequest.setEntitlementSource(EntitlementSource.UNKNOWN_ENTITLEMENT_SOURCE);
    entitlementsrequest.setEntitlementResult(EntitlementResult.UNKNOWN_ENTITLEMENT_RESULT);
    entitlementsrequest.setToken('');
    entitlementsrequest.setIsUserRegistered(false);

    let entitlementsrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementsrequestDeserialized = deserialize(
        entitlementsrequest.toArray(undefined));
    expect(entitlementsrequestDeserialized.toArray(undefined)).to.deep.equal(
        entitlementsrequest.toArray(undefined));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest.getIsUserRegistered());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementsrequestDeserialized = deserialize(
        entitlementsrequest.toArray(true));
    expect(entitlementsrequestDeserialized.toArray(true)).to.deep.equal(
        entitlementsrequest.toArray(true));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest.getIsUserRegistered());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementsrequestDeserialized = new EntitlementsRequest(entitlementsrequest.toArray(false), false);
    expect(entitlementsrequestDeserialized.toArray(false)).to.deep.equal(
        entitlementsrequest.toArray(false));

    // Verify fields.
    expect(entitlementsrequestDeserialized.getUsedEntitlement()).to.deep.equal(
        entitlementsrequest.getUsedEntitlement());
    expect(entitlementsrequestDeserialized.getClientEventTime()).to.deep.equal(
        entitlementsrequest.getClientEventTime());
    expect(entitlementsrequestDeserialized.getEntitlementSource()).to.deep.equal(
        entitlementsrequest.getEntitlementSource());
    expect(entitlementsrequestDeserialized.getEntitlementResult()).to.deep.equal(
        entitlementsrequest.getEntitlementResult());
    expect(entitlementsrequestDeserialized.getToken()).to.deep.equal(
        entitlementsrequest.getToken());
    expect(entitlementsrequestDeserialized.getIsUserRegistered()).to.deep.equal(
        entitlementsrequest.getIsUserRegistered());
  });
});

describe('EntitlementsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementsResponse  */ entitlementsresponse = new EntitlementsResponse();
    entitlementsresponse.setJwt('');

    let entitlementsresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    entitlementsresponseDeserialized = deserialize(
        entitlementsresponse.toArray(undefined));
    expect(entitlementsresponseDeserialized.toArray(undefined)).to.deep.equal(
        entitlementsresponse.toArray(undefined));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse.getJwt());

    // Verify includeLabel true
    // Verify serialized arrays.
    entitlementsresponseDeserialized = deserialize(
        entitlementsresponse.toArray(true));
    expect(entitlementsresponseDeserialized.toArray(true)).to.deep.equal(
        entitlementsresponse.toArray(true));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse.getJwt());

    // Verify includeLabel false
    // Verify serialized arrays.
    entitlementsresponseDeserialized = new EntitlementsResponse(entitlementsresponse.toArray(false), false);
    expect(entitlementsresponseDeserialized.toArray(false)).to.deep.equal(
        entitlementsresponse.toArray(false));

    // Verify fields.
    expect(entitlementsresponseDeserialized.getJwt()).to.deep.equal(
        entitlementsresponse.getJwt());
  });
});

describe('EventParams', () => {
  it('should deserialize correctly', () => {
    const /** !EventParams  */ eventparams = new EventParams();
    eventparams.setSmartboxMessage('');
    eventparams.setGpayTransactionId('');
    eventparams.setHadLogged(false);
    eventparams.setSku('');
    eventparams.setOldTransactionId('');
    eventparams.setIsUserRegistered(false);
    eventparams.setSubscriptionFlow('');

    let eventparamsDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    eventparamsDeserialized = deserialize(
        eventparams.toArray(undefined));
    expect(eventparamsDeserialized.toArray(undefined)).to.deep.equal(
        eventparams.toArray(undefined));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams.getSubscriptionFlow());

    // Verify includeLabel true
    // Verify serialized arrays.
    eventparamsDeserialized = deserialize(
        eventparams.toArray(true));
    expect(eventparamsDeserialized.toArray(true)).to.deep.equal(
        eventparams.toArray(true));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams.getSubscriptionFlow());

    // Verify includeLabel false
    // Verify serialized arrays.
    eventparamsDeserialized = new EventParams(eventparams.toArray(false), false);
    expect(eventparamsDeserialized.toArray(false)).to.deep.equal(
        eventparams.toArray(false));

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams.getSku());
    expect(eventparamsDeserialized.getOldTransactionId()).to.deep.equal(
        eventparams.getOldTransactionId());
    expect(eventparamsDeserialized.getIsUserRegistered()).to.deep.equal(
        eventparams.getIsUserRegistered());
    expect(eventparamsDeserialized.getSubscriptionFlow()).to.deep.equal(
        eventparams.getSubscriptionFlow());
  });
});

describe('FinishedLoggingResponse', () => {
  it('should deserialize correctly', () => {
    const /** !FinishedLoggingResponse  */ finishedloggingresponse = new FinishedLoggingResponse();
    finishedloggingresponse.setComplete(false);
    finishedloggingresponse.setError('');

    let finishedloggingresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = deserialize(
        finishedloggingresponse.toArray(undefined));
    expect(finishedloggingresponseDeserialized.toArray(undefined)).to.deep.equal(
        finishedloggingresponse.toArray(undefined));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse.getError());

    // Verify includeLabel true
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = deserialize(
        finishedloggingresponse.toArray(true));
    expect(finishedloggingresponseDeserialized.toArray(true)).to.deep.equal(
        finishedloggingresponse.toArray(true));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse.getError());

    // Verify includeLabel false
    // Verify serialized arrays.
    finishedloggingresponseDeserialized = new FinishedLoggingResponse(finishedloggingresponse.toArray(false), false);
    expect(finishedloggingresponseDeserialized.toArray(false)).to.deep.equal(
        finishedloggingresponse.toArray(false));

    // Verify fields.
    expect(finishedloggingresponseDeserialized.getComplete()).to.deep.equal(
        finishedloggingresponse.getComplete());
    expect(finishedloggingresponseDeserialized.getError()).to.deep.equal(
        finishedloggingresponse.getError());
  });
});

describe('LinkSaveTokenRequest', () => {
  it('should deserialize correctly', () => {
    const /** !LinkSaveTokenRequest  */ linksavetokenrequest = new LinkSaveTokenRequest();
    linksavetokenrequest.setAuthCode('');
    linksavetokenrequest.setToken('');

    let linksavetokenrequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = deserialize(
        linksavetokenrequest.toArray(undefined));
    expect(linksavetokenrequestDeserialized.toArray(undefined)).to.deep.equal(
        linksavetokenrequest.toArray(undefined));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest.getToken());

    // Verify includeLabel true
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = deserialize(
        linksavetokenrequest.toArray(true));
    expect(linksavetokenrequestDeserialized.toArray(true)).to.deep.equal(
        linksavetokenrequest.toArray(true));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest.getToken());

    // Verify includeLabel false
    // Verify serialized arrays.
    linksavetokenrequestDeserialized = new LinkSaveTokenRequest(linksavetokenrequest.toArray(false), false);
    expect(linksavetokenrequestDeserialized.toArray(false)).to.deep.equal(
        linksavetokenrequest.toArray(false));

    // Verify fields.
    expect(linksavetokenrequestDeserialized.getAuthCode()).to.deep.equal(
        linksavetokenrequest.getAuthCode());
    expect(linksavetokenrequestDeserialized.getToken()).to.deep.equal(
        linksavetokenrequest.getToken());
  });
});

describe('LinkingInfoResponse', () => {
  it('should deserialize correctly', () => {
    const /** !LinkingInfoResponse  */ linkinginforesponse = new LinkingInfoResponse();
    linkinginforesponse.setRequested(false);

    let linkinginforesponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    linkinginforesponseDeserialized = deserialize(
        linkinginforesponse.toArray(undefined));
    expect(linkinginforesponseDeserialized.toArray(undefined)).to.deep.equal(
        linkinginforesponse.toArray(undefined));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse.getRequested());

    // Verify includeLabel true
    // Verify serialized arrays.
    linkinginforesponseDeserialized = deserialize(
        linkinginforesponse.toArray(true));
    expect(linkinginforesponseDeserialized.toArray(true)).to.deep.equal(
        linkinginforesponse.toArray(true));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse.getRequested());

    // Verify includeLabel false
    // Verify serialized arrays.
    linkinginforesponseDeserialized = new LinkingInfoResponse(linkinginforesponse.toArray(false), false);
    expect(linkinginforesponseDeserialized.toArray(false)).to.deep.equal(
        linkinginforesponse.toArray(false));

    // Verify fields.
    expect(linkinginforesponseDeserialized.getRequested()).to.deep.equal(
        linkinginforesponse.getRequested());
  });
});

describe('SkuSelectedResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SkuSelectedResponse  */ skuselectedresponse = new SkuSelectedResponse();
    skuselectedresponse.setSku('');
    skuselectedresponse.setOldSku('');
    skuselectedresponse.setOneTime(false);
    skuselectedresponse.setPlayOffer('');
    skuselectedresponse.setOldPlayOffer('');

    let skuselectedresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    skuselectedresponseDeserialized = deserialize(
        skuselectedresponse.toArray(undefined));
    expect(skuselectedresponseDeserialized.toArray(undefined)).to.deep.equal(
        skuselectedresponse.toArray(undefined));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse.getOldPlayOffer());

    // Verify includeLabel true
    // Verify serialized arrays.
    skuselectedresponseDeserialized = deserialize(
        skuselectedresponse.toArray(true));
    expect(skuselectedresponseDeserialized.toArray(true)).to.deep.equal(
        skuselectedresponse.toArray(true));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse.getOldPlayOffer());

    // Verify includeLabel false
    // Verify serialized arrays.
    skuselectedresponseDeserialized = new SkuSelectedResponse(skuselectedresponse.toArray(false), false);
    expect(skuselectedresponseDeserialized.toArray(false)).to.deep.equal(
        skuselectedresponse.toArray(false));

    // Verify fields.
    expect(skuselectedresponseDeserialized.getSku()).to.deep.equal(
        skuselectedresponse.getSku());
    expect(skuselectedresponseDeserialized.getOldSku()).to.deep.equal(
        skuselectedresponse.getOldSku());
    expect(skuselectedresponseDeserialized.getOneTime()).to.deep.equal(
        skuselectedresponse.getOneTime());
    expect(skuselectedresponseDeserialized.getPlayOffer()).to.deep.equal(
        skuselectedresponse.getPlayOffer());
    expect(skuselectedresponseDeserialized.getOldPlayOffer()).to.deep.equal(
        skuselectedresponse.getOldPlayOffer());
  });
});

describe('SmartBoxMessage', () => {
  it('should deserialize correctly', () => {
    const /** !SmartBoxMessage  */ smartboxmessage = new SmartBoxMessage();
    smartboxmessage.setIsClicked(false);

    let smartboxmessageDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    smartboxmessageDeserialized = deserialize(
        smartboxmessage.toArray(undefined));
    expect(smartboxmessageDeserialized.toArray(undefined)).to.deep.equal(
        smartboxmessage.toArray(undefined));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage.getIsClicked());

    // Verify includeLabel true
    // Verify serialized arrays.
    smartboxmessageDeserialized = deserialize(
        smartboxmessage.toArray(true));
    expect(smartboxmessageDeserialized.toArray(true)).to.deep.equal(
        smartboxmessage.toArray(true));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage.getIsClicked());

    // Verify includeLabel false
    // Verify serialized arrays.
    smartboxmessageDeserialized = new SmartBoxMessage(smartboxmessage.toArray(false), false);
    expect(smartboxmessageDeserialized.toArray(false)).to.deep.equal(
        smartboxmessage.toArray(false));

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage.getIsClicked());
  });
});

describe('SubscribeResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SubscribeResponse  */ subscriberesponse = new SubscribeResponse();
    subscriberesponse.setSubscribe(false);

    let subscriberesponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    subscriberesponseDeserialized = deserialize(
        subscriberesponse.toArray(undefined));
    expect(subscriberesponseDeserialized.toArray(undefined)).to.deep.equal(
        subscriberesponse.toArray(undefined));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse.getSubscribe());

    // Verify includeLabel true
    // Verify serialized arrays.
    subscriberesponseDeserialized = deserialize(
        subscriberesponse.toArray(true));
    expect(subscriberesponseDeserialized.toArray(true)).to.deep.equal(
        subscriberesponse.toArray(true));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse.getSubscribe());

    // Verify includeLabel false
    // Verify serialized arrays.
    subscriberesponseDeserialized = new SubscribeResponse(subscriberesponse.toArray(false), false);
    expect(subscriberesponseDeserialized.toArray(false)).to.deep.equal(
        subscriberesponse.toArray(false));

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse.getSubscribe());
  });
});

describe('Timestamp', () => {
  it('should deserialize correctly', () => {
    const /** !Timestamp  */ timestamp = new Timestamp();
    timestamp.setSeconds(0);
    timestamp.setNanos(0);

    let timestampDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    timestampDeserialized = deserialize(
        timestamp.toArray(undefined));
    expect(timestampDeserialized.toArray(undefined)).to.deep.equal(
        timestamp.toArray(undefined));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp.getNanos());

    // Verify includeLabel true
    // Verify serialized arrays.
    timestampDeserialized = deserialize(
        timestamp.toArray(true));
    expect(timestampDeserialized.toArray(true)).to.deep.equal(
        timestamp.toArray(true));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp.getNanos());

    // Verify includeLabel false
    // Verify serialized arrays.
    timestampDeserialized = new Timestamp(timestamp.toArray(false), false);
    expect(timestampDeserialized.toArray(false)).to.deep.equal(
        timestamp.toArray(false));

    // Verify fields.
    expect(timestampDeserialized.getSeconds()).to.deep.equal(
        timestamp.getSeconds());
    expect(timestampDeserialized.getNanos()).to.deep.equal(
        timestamp.getNanos());
  });
});

describe('ToastCloseRequest', () => {
  it('should deserialize correctly', () => {
    const /** !ToastCloseRequest  */ toastcloserequest = new ToastCloseRequest();
    toastcloserequest.setClose(false);

    let toastcloserequestDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    toastcloserequestDeserialized = deserialize(
        toastcloserequest.toArray(undefined));
    expect(toastcloserequestDeserialized.toArray(undefined)).to.deep.equal(
        toastcloserequest.toArray(undefined));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest.getClose());

    // Verify includeLabel true
    // Verify serialized arrays.
    toastcloserequestDeserialized = deserialize(
        toastcloserequest.toArray(true));
    expect(toastcloserequestDeserialized.toArray(true)).to.deep.equal(
        toastcloserequest.toArray(true));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest.getClose());

    // Verify includeLabel false
    // Verify serialized arrays.
    toastcloserequestDeserialized = new ToastCloseRequest(toastcloserequest.toArray(false), false);
    expect(toastcloserequestDeserialized.toArray(false)).to.deep.equal(
        toastcloserequest.toArray(false));

    // Verify fields.
    expect(toastcloserequestDeserialized.getClose()).to.deep.equal(
        toastcloserequest.getClose());
  });
});

describe('ViewSubscriptionsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !ViewSubscriptionsResponse  */ viewsubscriptionsresponse = new ViewSubscriptionsResponse();
    viewsubscriptionsresponse.setNative(false);

    let viewsubscriptionsresponseDeserialized;

    // Verify includeLabel undefined
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = deserialize(
        viewsubscriptionsresponse.toArray(undefined));
    expect(viewsubscriptionsresponseDeserialized.toArray(undefined)).to.deep.equal(
        viewsubscriptionsresponse.toArray(undefined));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse.getNative());

    // Verify includeLabel true
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = deserialize(
        viewsubscriptionsresponse.toArray(true));
    expect(viewsubscriptionsresponseDeserialized.toArray(true)).to.deep.equal(
        viewsubscriptionsresponse.toArray(true));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse.getNative());

    // Verify includeLabel false
    // Verify serialized arrays.
    viewsubscriptionsresponseDeserialized = new ViewSubscriptionsResponse(viewsubscriptionsresponse.toArray(false), false);
    expect(viewsubscriptionsresponseDeserialized.toArray(false)).to.deep.equal(
        viewsubscriptionsresponse.toArray(false));

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse.getNative());
  });
});
