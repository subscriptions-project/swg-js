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

import {
    AccountCreationRequest,
    AlreadySubscribedResponse,
    AnalyticsContext,
    AnalyticsEvent,
    AnalyticsEventMeta,
    AnalyticsRequest,
    EntitlementsResponse,
    EventOriginator,
    EventParams,
    LinkSaveTokenRequest,
    LinkingInfoResponse,
    SkuSelectedResponse,
    SmartBoxMessage,
    SubscribeResponse,
    ViewSubscriptionsResponse,
    deserialize} from './api_messages';

/**
 * Compare two protos
 * @param {!Array} thisArray
 * @param {!Array} otherArray
 * @return {boolean}
 */
function isEqual(thisArray, otherArray) {
  if (!otherArray || !thisArray) {
    return false;
  }
  for (let i = 0; i < otherArray.length; i++) {
    const first = thisArray[i];
    const second = otherArray[i];
    if (Array.isArray(first)) {
      if (!Array.isArray(second)) {
        return false;
      }
      if (!isEqual(first, second)) {
        return false;
      }
    } else {
      if (first != second) {
        return false;
      }
    }
  }
  return true;
}


describe('api_messages', () => {

  describe('test_AccountCreationRequest', () => {
    it('should deserialize correctly', () => {
      const /** !AccountCreationRequest  */ accountcreationrequest = new AccountCreationRequest();
      accountcreationrequest.setComplete(false);
      const accountcreationrequestSerialized = accountcreationrequest.toArray();
      const accountcreationrequestDeserialized = deserialize(
          accountcreationrequestSerialized);
      expect(accountcreationrequestDeserialized).to.not.be.null;
      expect(isEqual(accountcreationrequest.toArray(),
          accountcreationrequestDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_AlreadySubscribedResponse', () => {
    it('should deserialize correctly', () => {
      const /** !AlreadySubscribedResponse  */ alreadysubscribedresponse = new AlreadySubscribedResponse();
      alreadysubscribedresponse.setSubscriberOrMember(false);
      alreadysubscribedresponse.setLinkRequested(false);
      const alreadysubscribedresponseSerialized = alreadysubscribedresponse.toArray();
      const alreadysubscribedresponseDeserialized = deserialize(
          alreadysubscribedresponseSerialized);
      expect(alreadysubscribedresponseDeserialized).to.not.be.null;
      expect(isEqual(alreadysubscribedresponse.toArray(),
          alreadysubscribedresponseDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_AnalyticsContext', () => {
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
      const analyticscontextSerialized = analyticscontext.toArray();
      const analyticscontextDeserialized = deserialize(
          analyticscontextSerialized);
      expect(analyticscontextDeserialized).to.not.be.null;
      expect(isEqual(analyticscontext.toArray(),
          analyticscontextDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_AnalyticsEventMeta', () => {
    it('should deserialize correctly', () => {
      const /** !AnalyticsEventMeta  */ analyticseventmeta = new AnalyticsEventMeta();
      analyticseventmeta.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
      analyticseventmeta.setIsFromUserAction(false);
      const analyticseventmetaSerialized = analyticseventmeta.toArray();
      const analyticseventmetaDeserialized = deserialize(
          analyticseventmetaSerialized);
      expect(analyticseventmetaDeserialized).to.not.be.null;
      expect(isEqual(analyticseventmeta.toArray(),
          analyticseventmetaDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_AnalyticsRequest', () => {
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
      const analyticsrequestSerialized = analyticsrequest.toArray();
      const analyticsrequestDeserialized = deserialize(
          analyticsrequestSerialized);
      expect(analyticsrequestDeserialized).to.not.be.null;
      expect(isEqual(analyticsrequest.toArray(),
          analyticsrequestDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_EntitlementsResponse', () => {
    it('should deserialize correctly', () => {
      const /** !EntitlementsResponse  */ entitlementsresponse = new EntitlementsResponse();
      entitlementsresponse.setJwt('');
      const entitlementsresponseSerialized = entitlementsresponse.toArray();
      const entitlementsresponseDeserialized = deserialize(
          entitlementsresponseSerialized);
      expect(entitlementsresponseDeserialized).to.not.be.null;
      expect(isEqual(entitlementsresponse.toArray(),
          entitlementsresponseDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_EventParams', () => {
    it('should deserialize correctly', () => {
      const /** !EventParams  */ eventparams = new EventParams();
      eventparams.setSmartboxMessage('');
      eventparams.setGpayTransactionId('');
      eventparams.setHadLogged(false);
      eventparams.setSku('');
      const eventparamsSerialized = eventparams.toArray();
      const eventparamsDeserialized = deserialize(
          eventparamsSerialized);
      expect(eventparamsDeserialized).to.not.be.null;
      expect(isEqual(eventparams.toArray(),
          eventparamsDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_LinkSaveTokenRequest', () => {
    it('should deserialize correctly', () => {
      const /** !LinkSaveTokenRequest  */ linksavetokenrequest = new LinkSaveTokenRequest();
      linksavetokenrequest.setAuthCode('');
      linksavetokenrequest.setToken('');
      const linksavetokenrequestSerialized = linksavetokenrequest.toArray();
      const linksavetokenrequestDeserialized = deserialize(
          linksavetokenrequestSerialized);
      expect(linksavetokenrequestDeserialized).to.not.be.null;
      expect(isEqual(linksavetokenrequest.toArray(),
          linksavetokenrequestDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_LinkingInfoResponse', () => {
    it('should deserialize correctly', () => {
      const /** !LinkingInfoResponse  */ linkinginforesponse = new LinkingInfoResponse();
      linkinginforesponse.setRequested(false);
      const linkinginforesponseSerialized = linkinginforesponse.toArray();
      const linkinginforesponseDeserialized = deserialize(
          linkinginforesponseSerialized);
      expect(linkinginforesponseDeserialized).to.not.be.null;
      expect(isEqual(linkinginforesponse.toArray(),
          linkinginforesponseDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_SkuSelectedResponse', () => {
    it('should deserialize correctly', () => {
      const /** !SkuSelectedResponse  */ skuselectedresponse = new SkuSelectedResponse();
      skuselectedresponse.setSku('');
      skuselectedresponse.setOldSku('');
      const skuselectedresponseSerialized = skuselectedresponse.toArray();
      const skuselectedresponseDeserialized = deserialize(
          skuselectedresponseSerialized);
      expect(skuselectedresponseDeserialized).to.not.be.null;
      expect(isEqual(skuselectedresponse.toArray(),
          skuselectedresponseDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_SmartBoxMessage', () => {
    it('should deserialize correctly', () => {
      const /** !SmartBoxMessage  */ smartboxmessage = new SmartBoxMessage();
      smartboxmessage.setIsClicked(false);
      const smartboxmessageSerialized = smartboxmessage.toArray();
      const smartboxmessageDeserialized = deserialize(
          smartboxmessageSerialized);
      expect(smartboxmessageDeserialized).to.not.be.null;
      expect(isEqual(smartboxmessage.toArray(),
          smartboxmessageDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_SubscribeResponse', () => {
    it('should deserialize correctly', () => {
      const /** !SubscribeResponse  */ subscriberesponse = new SubscribeResponse();
      subscriberesponse.setSubscribe(false);
      const subscriberesponseSerialized = subscriberesponse.toArray();
      const subscriberesponseDeserialized = deserialize(
          subscriberesponseSerialized);
      expect(subscriberesponseDeserialized).to.not.be.null;
      expect(isEqual(subscriberesponse.toArray(),
          subscriberesponseDeserialized.toArray())).to.be.true;
    });
  });

  describe('test_ViewSubscriptionsResponse', () => {
    it('should deserialize correctly', () => {
      const /** !ViewSubscriptionsResponse  */ viewsubscriptionsresponse = new ViewSubscriptionsResponse();
      viewsubscriptionsresponse.setNative(false);
      const viewsubscriptionsresponseSerialized = viewsubscriptionsresponse.toArray();
      const viewsubscriptionsresponseDeserialized = deserialize(
          viewsubscriptionsresponseSerialized);
      expect(viewsubscriptionsresponseDeserialized).to.not.be.null;
      expect(isEqual(viewsubscriptionsresponse.toArray(),
          viewsubscriptionsresponseDeserialized.toArray())).to.be.true;
    });
  });
});

