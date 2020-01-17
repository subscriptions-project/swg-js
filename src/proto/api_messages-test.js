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

import {AccountCreationRequest, AlreadySubscribedResponse, AnalyticsContext, AnalyticsEvent, AnalyticsEventMeta, AnalyticsRequest, EntitlementsResponse, EventOriginator, EventParams, FinishedLoggingResponse, LinkSaveTokenRequest, LinkingInfoResponse, SkuSelectedResponse, SmartBoxMessage, SubscribeResponse, ViewSubscriptionsResponse, deserialize, getLabel} from './api_messages';

describe('deserialize', () => {
  it('throws if deserialization fails', () => {
    expect(() => deserialize(['🐶'])).to.throw('Deserialization failed for 🐶');
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

    // Verify serialized arrays.
    const accountcreationrequestDeserialized = deserialize(
        accountcreationrequest.toArray());
    expect(accountcreationrequestDeserialized.toArray()).to.deep.equal(
        accountcreationrequest.toArray());

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

    // Verify serialized arrays.
    const alreadysubscribedresponseDeserialized = deserialize(
        alreadysubscribedresponse.toArray());
    expect(alreadysubscribedresponseDeserialized.toArray()).to.deep.equal(
        alreadysubscribedresponse.toArray());

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

    // Verify serialized arrays.
    const analyticscontextDeserialized = deserialize(
        analyticscontext.toArray());
    expect(analyticscontextDeserialized.toArray()).to.deep.equal(
        analyticscontext.toArray());

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

    // Verify serialized arrays.
    const analyticseventmetaDeserialized = deserialize(
        analyticseventmeta.toArray());
    expect(analyticseventmetaDeserialized.toArray()).to.deep.equal(
        analyticseventmeta.toArray());

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
    analyticsrequest.setParams(eventparams);

    // Verify serialized arrays.
    const analyticsrequestDeserialized = deserialize(
        analyticsrequest.toArray());
    expect(analyticsrequestDeserialized.toArray()).to.deep.equal(
        analyticsrequest.toArray());

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

describe('EntitlementsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !EntitlementsResponse  */ entitlementsresponse = new EntitlementsResponse();
    entitlementsresponse.setJwt('');

    // Verify serialized arrays.
    const entitlementsresponseDeserialized = deserialize(
        entitlementsresponse.toArray());
    expect(entitlementsresponseDeserialized.toArray()).to.deep.equal(
        entitlementsresponse.toArray());

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

    // Verify serialized arrays.
    const eventparamsDeserialized = deserialize(
        eventparams.toArray());
    expect(eventparamsDeserialized.toArray()).to.deep.equal(
        eventparams.toArray());

    // Verify fields.
    expect(eventparamsDeserialized.getSmartboxMessage()).to.deep.equal(
        eventparams.getSmartboxMessage());
    expect(eventparamsDeserialized.getGpayTransactionId()).to.deep.equal(
        eventparams.getGpayTransactionId());
    expect(eventparamsDeserialized.getHadLogged()).to.deep.equal(
        eventparams.getHadLogged());
    expect(eventparamsDeserialized.getSku()).to.deep.equal(
        eventparams.getSku());
  });
});

describe('FinishedLoggingResponse', () => {
  it('should deserialize correctly', () => {
    const /** !FinishedLoggingResponse  */ finishedloggingresponse = new FinishedLoggingResponse();
    finishedloggingresponse.setComplete(false);
    finishedloggingresponse.setError('');

    // Verify serialized arrays.
    const finishedloggingresponseDeserialized = deserialize(
        finishedloggingresponse.toArray());
    expect(finishedloggingresponseDeserialized.toArray()).to.deep.equal(
        finishedloggingresponse.toArray());

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

    // Verify serialized arrays.
    const linksavetokenrequestDeserialized = deserialize(
        linksavetokenrequest.toArray());
    expect(linksavetokenrequestDeserialized.toArray()).to.deep.equal(
        linksavetokenrequest.toArray());

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

    // Verify serialized arrays.
    const linkinginforesponseDeserialized = deserialize(
        linkinginforesponse.toArray());
    expect(linkinginforesponseDeserialized.toArray()).to.deep.equal(
        linkinginforesponse.toArray());

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

    // Verify serialized arrays.
    const skuselectedresponseDeserialized = deserialize(
        skuselectedresponse.toArray());
    expect(skuselectedresponseDeserialized.toArray()).to.deep.equal(
        skuselectedresponse.toArray());

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

    // Verify serialized arrays.
    const smartboxmessageDeserialized = deserialize(
        smartboxmessage.toArray());
    expect(smartboxmessageDeserialized.toArray()).to.deep.equal(
        smartboxmessage.toArray());

    // Verify fields.
    expect(smartboxmessageDeserialized.getIsClicked()).to.deep.equal(
        smartboxmessage.getIsClicked());
  });
});

describe('SubscribeResponse', () => {
  it('should deserialize correctly', () => {
    const /** !SubscribeResponse  */ subscriberesponse = new SubscribeResponse();
    subscriberesponse.setSubscribe(false);

    // Verify serialized arrays.
    const subscriberesponseDeserialized = deserialize(
        subscriberesponse.toArray());
    expect(subscriberesponseDeserialized.toArray()).to.deep.equal(
        subscriberesponse.toArray());

    // Verify fields.
    expect(subscriberesponseDeserialized.getSubscribe()).to.deep.equal(
        subscriberesponse.getSubscribe());
  });
});

describe('ViewSubscriptionsResponse', () => {
  it('should deserialize correctly', () => {
    const /** !ViewSubscriptionsResponse  */ viewsubscriptionsresponse = new ViewSubscriptionsResponse();
    viewsubscriptionsresponse.setNative(false);

    // Verify serialized arrays.
    const viewsubscriptionsresponseDeserialized = deserialize(
        viewsubscriptionsresponse.toArray());
    expect(viewsubscriptionsresponseDeserialized.toArray()).to.deep.equal(
        viewsubscriptionsresponse.toArray());

    // Verify fields.
    expect(viewsubscriptionsresponseDeserialized.getNative()).to.deep.equal(
        viewsubscriptionsresponse.getNative());
  });
});
