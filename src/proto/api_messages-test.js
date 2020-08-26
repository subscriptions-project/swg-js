/**
  * @fileoverview Proto lite test.
  */

 goog.module('subscribewithgoogle.api.messages.closure');
 goog.setTestOnly('subscribewithgoogle.api.messages.closure');
 
 const testSuite = goog.require('goog.testing.testSuite');
 
 const {AccountCreationRequest, AlreadySubscribedResponse, AnalyticsContext, AnalyticsEvent, AnalyticsEventMeta, AnalyticsRequest, EntitlementJwt, EntitlementsRequest, EntitlementsResponse, EventOriginator, EventParams, FinishedLoggingResponse, LinkSaveTokenRequest, LinkingInfoResponse, SkuSelectedResponse, SmartBoxMessage, SubscribeResponse, Timestamp, ViewSubscriptionsResponse, deserialize, getLabel} = goog.require('subscribewithgoogle.api.messages');
 
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
 
 
 testSuite({
   setup() {},
 
   test_getLabel() {
     assertTrue(getLabel(AccountCreationRequest) === 'AccountCreationRequest');
   },
 
   test_AccountCreationRequest() {
     // includesLabel is undefined
     const /** !AccountCreationRequest  */ accountcreationrequest = new AccountCreationRequest();
     accountcreationrequest.setComplete(false);
     let accountcreationrequestSerialized = accountcreationrequest.toArray(undefined);
     let accountcreationrequestDeserialized = deserialize(
         accountcreationrequestSerialized);
     assertNotNull(accountcreationrequestDeserialized);
     assertTrue(isEqual(accountcreationrequest.toArray(undefined),
                        accountcreationrequestDeserialized.toArray(undefined)));
     // includesLabel is true
     accountcreationrequestSerialized = accountcreationrequest.toArray(true);
     accountcreationrequestDeserialized = deserialize(
         accountcreationrequestSerialized);
     assertNotNull(accountcreationrequestDeserialized);
     assertTrue(isEqual(accountcreationrequest.toArray(true),
                        accountcreationrequestDeserialized.toArray(true)));
     // includesLabel is false
     accountcreationrequestSerialized = accountcreationrequest.toArray(false);
     accountcreationrequestDeserialized = new AccountCreationRequest(
         accountcreationrequestSerialized, false);
     assertNotNull(accountcreationrequestDeserialized);
     assertTrue(isEqual(accountcreationrequest.toArray(false),
                        accountcreationrequestDeserialized.toArray(false)));
   },
 
   test_AlreadySubscribedResponse() {
     // includesLabel is undefined
     const /** !AlreadySubscribedResponse  */ alreadysubscribedresponse = new AlreadySubscribedResponse();
     alreadysubscribedresponse.setSubscriberOrMember(false);
     alreadysubscribedresponse.setLinkRequested(false);
     let alreadysubscribedresponseSerialized = alreadysubscribedresponse.toArray(undefined);
     let alreadysubscribedresponseDeserialized = deserialize(
         alreadysubscribedresponseSerialized);
     assertNotNull(alreadysubscribedresponseDeserialized);
     assertTrue(isEqual(alreadysubscribedresponse.toArray(undefined),
                        alreadysubscribedresponseDeserialized.toArray(undefined)));
     // includesLabel is true
     alreadysubscribedresponseSerialized = alreadysubscribedresponse.toArray(true);
     alreadysubscribedresponseDeserialized = deserialize(
         alreadysubscribedresponseSerialized);
     assertNotNull(alreadysubscribedresponseDeserialized);
     assertTrue(isEqual(alreadysubscribedresponse.toArray(true),
                        alreadysubscribedresponseDeserialized.toArray(true)));
     // includesLabel is false
     alreadysubscribedresponseSerialized = alreadysubscribedresponse.toArray(false);
     alreadysubscribedresponseDeserialized = new AlreadySubscribedResponse(
         alreadysubscribedresponseSerialized, false);
     assertNotNull(alreadysubscribedresponseDeserialized);
     assertTrue(isEqual(alreadysubscribedresponse.toArray(false),
                        alreadysubscribedresponseDeserialized.toArray(false)));
   },
 
   test_AnalyticsContext() {
     // includesLabel is undefined
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
     let analyticscontextSerialized = analyticscontext.toArray(undefined);
     let analyticscontextDeserialized = deserialize(
         analyticscontextSerialized);
     assertNotNull(analyticscontextDeserialized);
     assertTrue(isEqual(analyticscontext.toArray(undefined),
                        analyticscontextDeserialized.toArray(undefined)));
     // includesLabel is true
     analyticscontextSerialized = analyticscontext.toArray(true);
     analyticscontextDeserialized = deserialize(
         analyticscontextSerialized);
     assertNotNull(analyticscontextDeserialized);
     assertTrue(isEqual(analyticscontext.toArray(true),
                        analyticscontextDeserialized.toArray(true)));
     // includesLabel is false
     analyticscontextSerialized = analyticscontext.toArray(false);
     analyticscontextDeserialized = new AnalyticsContext(
         analyticscontextSerialized, false);
     assertNotNull(analyticscontextDeserialized);
     assertTrue(isEqual(analyticscontext.toArray(false),
                        analyticscontextDeserialized.toArray(false)));
   },
 
   test_AnalyticsEventMeta() {
     // includesLabel is undefined
     const /** !AnalyticsEventMeta  */ analyticseventmeta = new AnalyticsEventMeta();
     analyticseventmeta.setEventOriginator(EventOriginator.UNKNOWN_CLIENT);
     analyticseventmeta.setIsFromUserAction(false);
     let analyticseventmetaSerialized = analyticseventmeta.toArray(undefined);
     let analyticseventmetaDeserialized = deserialize(
         analyticseventmetaSerialized);
     assertNotNull(analyticseventmetaDeserialized);
     assertTrue(isEqual(analyticseventmeta.toArray(undefined),
                        analyticseventmetaDeserialized.toArray(undefined)));
     // includesLabel is true
     analyticseventmetaSerialized = analyticseventmeta.toArray(true);
     analyticseventmetaDeserialized = deserialize(
         analyticseventmetaSerialized);
     assertNotNull(analyticseventmetaDeserialized);
     assertTrue(isEqual(analyticseventmeta.toArray(true),
                        analyticseventmetaDeserialized.toArray(true)));
     // includesLabel is false
     analyticseventmetaSerialized = analyticseventmeta.toArray(false);
     analyticseventmetaDeserialized = new AnalyticsEventMeta(
         analyticseventmetaSerialized, false);
     assertNotNull(analyticseventmetaDeserialized);
     assertTrue(isEqual(analyticseventmeta.toArray(false),
                        analyticseventmetaDeserialized.toArray(false)));
   },
 
   test_AnalyticsRequest() {
     // includesLabel is undefined
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
     analyticsrequest.setParams(eventparams);
     let analyticsrequestSerialized = analyticsrequest.toArray(undefined);
     let analyticsrequestDeserialized = deserialize(
         analyticsrequestSerialized);
     assertNotNull(analyticsrequestDeserialized);
     assertTrue(isEqual(analyticsrequest.toArray(undefined),
                        analyticsrequestDeserialized.toArray(undefined)));
     // includesLabel is true
     analyticsrequestSerialized = analyticsrequest.toArray(true);
     analyticsrequestDeserialized = deserialize(
         analyticsrequestSerialized);
     assertNotNull(analyticsrequestDeserialized);
     assertTrue(isEqual(analyticsrequest.toArray(true),
                        analyticsrequestDeserialized.toArray(true)));
     // includesLabel is false
     analyticsrequestSerialized = analyticsrequest.toArray(false);
     analyticsrequestDeserialized = new AnalyticsRequest(
         analyticsrequestSerialized, false);
     assertNotNull(analyticsrequestDeserialized);
     assertTrue(isEqual(analyticsrequest.toArray(false),
                        analyticsrequestDeserialized.toArray(false)));
   },
 
   test_EntitlementJwt() {
     // includesLabel is undefined
     const /** !EntitlementJwt  */ entitlementjwt = new EntitlementJwt();
     entitlementjwt.setJwt('');
     entitlementjwt.setSource('');
     let entitlementjwtSerialized = entitlementjwt.toArray(undefined);
     let entitlementjwtDeserialized = deserialize(
         entitlementjwtSerialized);
     assertNotNull(entitlementjwtDeserialized);
     assertTrue(isEqual(entitlementjwt.toArray(undefined),
                        entitlementjwtDeserialized.toArray(undefined)));
     // includesLabel is true
     entitlementjwtSerialized = entitlementjwt.toArray(true);
     entitlementjwtDeserialized = deserialize(
         entitlementjwtSerialized);
     assertNotNull(entitlementjwtDeserialized);
     assertTrue(isEqual(entitlementjwt.toArray(true),
                        entitlementjwtDeserialized.toArray(true)));
     // includesLabel is false
     entitlementjwtSerialized = entitlementjwt.toArray(false);
     entitlementjwtDeserialized = new EntitlementJwt(
         entitlementjwtSerialized, false);
     assertNotNull(entitlementjwtDeserialized);
     assertTrue(isEqual(entitlementjwt.toArray(false),
                        entitlementjwtDeserialized.toArray(false)));
   },
 
   test_EntitlementsRequest() {
     // includesLabel is undefined
     const /** !EntitlementsRequest  */ entitlementsrequest = new EntitlementsRequest();
     const /** !EntitlementJwt  */ entitlementjwt = new EntitlementJwt();
     entitlementjwt.setJwt('');
     entitlementjwt.setSource('');
     entitlementsrequest.setUsedEntitlement(entitlementjwt);
     const /** !Timestamp  */ timestamp = new Timestamp();
     timestamp.setSeconds(0);
     timestamp.setNanos(0);
     entitlementsrequest.setClientEventTime(timestamp);
     let entitlementsrequestSerialized = entitlementsrequest.toArray(undefined);
     let entitlementsrequestDeserialized = deserialize(
         entitlementsrequestSerialized);
     assertNotNull(entitlementsrequestDeserialized);
     assertTrue(isEqual(entitlementsrequest.toArray(undefined),
                        entitlementsrequestDeserialized.toArray(undefined)));
     // includesLabel is true
     entitlementsrequestSerialized = entitlementsrequest.toArray(true);
     entitlementsrequestDeserialized = deserialize(
         entitlementsrequestSerialized);
     assertNotNull(entitlementsrequestDeserialized);
     assertTrue(isEqual(entitlementsrequest.toArray(true),
                        entitlementsrequestDeserialized.toArray(true)));
     // includesLabel is false
     entitlementsrequestSerialized = entitlementsrequest.toArray(false);
     entitlementsrequestDeserialized = new EntitlementsRequest(
         entitlementsrequestSerialized, false);
     assertNotNull(entitlementsrequestDeserialized);
     assertTrue(isEqual(entitlementsrequest.toArray(false),
                        entitlementsrequestDeserialized.toArray(false)));
   },
 
   test_EntitlementsResponse() {
     // includesLabel is undefined
     const /** !EntitlementsResponse  */ entitlementsresponse = new EntitlementsResponse();
     entitlementsresponse.setJwt('');
     let entitlementsresponseSerialized = entitlementsresponse.toArray(undefined);
     let entitlementsresponseDeserialized = deserialize(
         entitlementsresponseSerialized);
     assertNotNull(entitlementsresponseDeserialized);
     assertTrue(isEqual(entitlementsresponse.toArray(undefined),
                        entitlementsresponseDeserialized.toArray(undefined)));
     // includesLabel is true
     entitlementsresponseSerialized = entitlementsresponse.toArray(true);
     entitlementsresponseDeserialized = deserialize(
         entitlementsresponseSerialized);
     assertNotNull(entitlementsresponseDeserialized);
     assertTrue(isEqual(entitlementsresponse.toArray(true),
                        entitlementsresponseDeserialized.toArray(true)));
     // includesLabel is false
     entitlementsresponseSerialized = entitlementsresponse.toArray(false);
     entitlementsresponseDeserialized = new EntitlementsResponse(
         entitlementsresponseSerialized, false);
     assertNotNull(entitlementsresponseDeserialized);
     assertTrue(isEqual(entitlementsresponse.toArray(false),
                        entitlementsresponseDeserialized.toArray(false)));
   },
 
   test_EventParams() {
     // includesLabel is undefined
     const /** !EventParams  */ eventparams = new EventParams();
     eventparams.setSmartboxMessage('');
     eventparams.setGpayTransactionId('');
     eventparams.setHadLogged(false);
     eventparams.setSku('');
     eventparams.setOldTransactionId('');
     let eventparamsSerialized = eventparams.toArray(undefined);
     let eventparamsDeserialized = deserialize(
         eventparamsSerialized);
     assertNotNull(eventparamsDeserialized);
     assertTrue(isEqual(eventparams.toArray(undefined),
                        eventparamsDeserialized.toArray(undefined)));
     // includesLabel is true
     eventparamsSerialized = eventparams.toArray(true);
     eventparamsDeserialized = deserialize(
         eventparamsSerialized);
     assertNotNull(eventparamsDeserialized);
     assertTrue(isEqual(eventparams.toArray(true),
                        eventparamsDeserialized.toArray(true)));
     // includesLabel is false
     eventparamsSerialized = eventparams.toArray(false);
     eventparamsDeserialized = new EventParams(
         eventparamsSerialized, false);
     assertNotNull(eventparamsDeserialized);
     assertTrue(isEqual(eventparams.toArray(false),
                        eventparamsDeserialized.toArray(false)));
   },
 
   test_FinishedLoggingResponse() {
     // includesLabel is undefined
     const /** !FinishedLoggingResponse  */ finishedloggingresponse = new FinishedLoggingResponse();
     finishedloggingresponse.setComplete(false);
     finishedloggingresponse.setError('');
     let finishedloggingresponseSerialized = finishedloggingresponse.toArray(undefined);
     let finishedloggingresponseDeserialized = deserialize(
         finishedloggingresponseSerialized);
     assertNotNull(finishedloggingresponseDeserialized);
     assertTrue(isEqual(finishedloggingresponse.toArray(undefined),
                        finishedloggingresponseDeserialized.toArray(undefined)));
     // includesLabel is true
     finishedloggingresponseSerialized = finishedloggingresponse.toArray(true);
     finishedloggingresponseDeserialized = deserialize(
         finishedloggingresponseSerialized);
     assertNotNull(finishedloggingresponseDeserialized);
     assertTrue(isEqual(finishedloggingresponse.toArray(true),
                        finishedloggingresponseDeserialized.toArray(true)));
     // includesLabel is false
     finishedloggingresponseSerialized = finishedloggingresponse.toArray(false);
     finishedloggingresponseDeserialized = new FinishedLoggingResponse(
         finishedloggingresponseSerialized, false);
     assertNotNull(finishedloggingresponseDeserialized);
     assertTrue(isEqual(finishedloggingresponse.toArray(false),
                        finishedloggingresponseDeserialized.toArray(false)));
   },
 
   test_LinkSaveTokenRequest() {
     // includesLabel is undefined
     const /** !LinkSaveTokenRequest  */ linksavetokenrequest = new LinkSaveTokenRequest();
     linksavetokenrequest.setAuthCode('');
     linksavetokenrequest.setToken('');
     let linksavetokenrequestSerialized = linksavetokenrequest.toArray(undefined);
     let linksavetokenrequestDeserialized = deserialize(
         linksavetokenrequestSerialized);
     assertNotNull(linksavetokenrequestDeserialized);
     assertTrue(isEqual(linksavetokenrequest.toArray(undefined),
                        linksavetokenrequestDeserialized.toArray(undefined)));
     // includesLabel is true
     linksavetokenrequestSerialized = linksavetokenrequest.toArray(true);
     linksavetokenrequestDeserialized = deserialize(
         linksavetokenrequestSerialized);
     assertNotNull(linksavetokenrequestDeserialized);
     assertTrue(isEqual(linksavetokenrequest.toArray(true),
                        linksavetokenrequestDeserialized.toArray(true)));
     // includesLabel is false
     linksavetokenrequestSerialized = linksavetokenrequest.toArray(false);
     linksavetokenrequestDeserialized = new LinkSaveTokenRequest(
         linksavetokenrequestSerialized, false);
     assertNotNull(linksavetokenrequestDeserialized);
     assertTrue(isEqual(linksavetokenrequest.toArray(false),
                        linksavetokenrequestDeserialized.toArray(false)));
   },
 
   test_LinkingInfoResponse() {
     // includesLabel is undefined
     const /** !LinkingInfoResponse  */ linkinginforesponse = new LinkingInfoResponse();
     linkinginforesponse.setRequested(false);
     let linkinginforesponseSerialized = linkinginforesponse.toArray(undefined);
     let linkinginforesponseDeserialized = deserialize(
         linkinginforesponseSerialized);
     assertNotNull(linkinginforesponseDeserialized);
     assertTrue(isEqual(linkinginforesponse.toArray(undefined),
                        linkinginforesponseDeserialized.toArray(undefined)));
     // includesLabel is true
     linkinginforesponseSerialized = linkinginforesponse.toArray(true);
     linkinginforesponseDeserialized = deserialize(
         linkinginforesponseSerialized);
     assertNotNull(linkinginforesponseDeserialized);
     assertTrue(isEqual(linkinginforesponse.toArray(true),
                        linkinginforesponseDeserialized.toArray(true)));
     // includesLabel is false
     linkinginforesponseSerialized = linkinginforesponse.toArray(false);
     linkinginforesponseDeserialized = new LinkingInfoResponse(
         linkinginforesponseSerialized, false);
     assertNotNull(linkinginforesponseDeserialized);
     assertTrue(isEqual(linkinginforesponse.toArray(false),
                        linkinginforesponseDeserialized.toArray(false)));
   },
 
   test_SkuSelectedResponse() {
     // includesLabel is undefined
     const /** !SkuSelectedResponse  */ skuselectedresponse = new SkuSelectedResponse();
     skuselectedresponse.setSku('');
     skuselectedresponse.setOldSku('');
     skuselectedresponse.setOneTime(false);
     skuselectedresponse.setPlayOffer('');
     skuselectedresponse.setOldPlayOffer('');
     let skuselectedresponseSerialized = skuselectedresponse.toArray(undefined);
     let skuselectedresponseDeserialized = deserialize(
         skuselectedresponseSerialized);
     assertNotNull(skuselectedresponseDeserialized);
     assertTrue(isEqual(skuselectedresponse.toArray(undefined),
                        skuselectedresponseDeserialized.toArray(undefined)));
     // includesLabel is true
     skuselectedresponseSerialized = skuselectedresponse.toArray(true);
     skuselectedresponseDeserialized = deserialize(
         skuselectedresponseSerialized);
     assertNotNull(skuselectedresponseDeserialized);
     assertTrue(isEqual(skuselectedresponse.toArray(true),
                        skuselectedresponseDeserialized.toArray(true)));
     // includesLabel is false
     skuselectedresponseSerialized = skuselectedresponse.toArray(false);
     skuselectedresponseDeserialized = new SkuSelectedResponse(
         skuselectedresponseSerialized, false);
     assertNotNull(skuselectedresponseDeserialized);
     assertTrue(isEqual(skuselectedresponse.toArray(false),
                        skuselectedresponseDeserialized.toArray(false)));
   },
 
   test_SmartBoxMessage() {
     // includesLabel is undefined
     const /** !SmartBoxMessage  */ smartboxmessage = new SmartBoxMessage();
     smartboxmessage.setIsClicked(false);
     let smartboxmessageSerialized = smartboxmessage.toArray(undefined);
     let smartboxmessageDeserialized = deserialize(
         smartboxmessageSerialized);
     assertNotNull(smartboxmessageDeserialized);
     assertTrue(isEqual(smartboxmessage.toArray(undefined),
                        smartboxmessageDeserialized.toArray(undefined)));
     // includesLabel is true
     smartboxmessageSerialized = smartboxmessage.toArray(true);
     smartboxmessageDeserialized = deserialize(
         smartboxmessageSerialized);
     assertNotNull(smartboxmessageDeserialized);
     assertTrue(isEqual(smartboxmessage.toArray(true),
                        smartboxmessageDeserialized.toArray(true)));
     // includesLabel is false
     smartboxmessageSerialized = smartboxmessage.toArray(false);
     smartboxmessageDeserialized = new SmartBoxMessage(
         smartboxmessageSerialized, false);
     assertNotNull(smartboxmessageDeserialized);
     assertTrue(isEqual(smartboxmessage.toArray(false),
                        smartboxmessageDeserialized.toArray(false)));
   },
 
   test_SubscribeResponse() {
     // includesLabel is undefined
     const /** !SubscribeResponse  */ subscriberesponse = new SubscribeResponse();
     subscriberesponse.setSubscribe(false);
     let subscriberesponseSerialized = subscriberesponse.toArray(undefined);
     let subscriberesponseDeserialized = deserialize(
         subscriberesponseSerialized);
     assertNotNull(subscriberesponseDeserialized);
     assertTrue(isEqual(subscriberesponse.toArray(undefined),
                        subscriberesponseDeserialized.toArray(undefined)));
     // includesLabel is true
     subscriberesponseSerialized = subscriberesponse.toArray(true);
     subscriberesponseDeserialized = deserialize(
         subscriberesponseSerialized);
     assertNotNull(subscriberesponseDeserialized);
     assertTrue(isEqual(subscriberesponse.toArray(true),
                        subscriberesponseDeserialized.toArray(true)));
     // includesLabel is false
     subscriberesponseSerialized = subscriberesponse.toArray(false);
     subscriberesponseDeserialized = new SubscribeResponse(
         subscriberesponseSerialized, false);
     assertNotNull(subscriberesponseDeserialized);
     assertTrue(isEqual(subscriberesponse.toArray(false),
                        subscriberesponseDeserialized.toArray(false)));
   },
 
   test_Timestamp() {
     // includesLabel is undefined
     const /** !Timestamp  */ timestamp = new Timestamp();
     timestamp.setSeconds(0);
     timestamp.setNanos(0);
     let timestampSerialized = timestamp.toArray(undefined);
     let timestampDeserialized = deserialize(
         timestampSerialized);
     assertNotNull(timestampDeserialized);
     assertTrue(isEqual(timestamp.toArray(undefined),
                        timestampDeserialized.toArray(undefined)));
     // includesLabel is true
     timestampSerialized = timestamp.toArray(true);
     timestampDeserialized = deserialize(
         timestampSerialized);
     assertNotNull(timestampDeserialized);
     assertTrue(isEqual(timestamp.toArray(true),
                        timestampDeserialized.toArray(true)));
     // includesLabel is false
     timestampSerialized = timestamp.toArray(false);
     timestampDeserialized = new Timestamp(
         timestampSerialized, false);
     assertNotNull(timestampDeserialized);
     assertTrue(isEqual(timestamp.toArray(false),
                        timestampDeserialized.toArray(false)));
   },
 
   test_ViewSubscriptionsResponse() {
     // includesLabel is undefined
     const /** !ViewSubscriptionsResponse  */ viewsubscriptionsresponse = new ViewSubscriptionsResponse();
     viewsubscriptionsresponse.setNative(false);
     let viewsubscriptionsresponseSerialized = viewsubscriptionsresponse.toArray(undefined);
     let viewsubscriptionsresponseDeserialized = deserialize(
         viewsubscriptionsresponseSerialized);
     assertNotNull(viewsubscriptionsresponseDeserialized);
     assertTrue(isEqual(viewsubscriptionsresponse.toArray(undefined),
                        viewsubscriptionsresponseDeserialized.toArray(undefined)));
     // includesLabel is true
     viewsubscriptionsresponseSerialized = viewsubscriptionsresponse.toArray(true);
     viewsubscriptionsresponseDeserialized = deserialize(
         viewsubscriptionsresponseSerialized);
     assertNotNull(viewsubscriptionsresponseDeserialized);
     assertTrue(isEqual(viewsubscriptionsresponse.toArray(true),
                        viewsubscriptionsresponseDeserialized.toArray(true)));
     // includesLabel is false
     viewsubscriptionsresponseSerialized = viewsubscriptionsresponse.toArray(false);
     viewsubscriptionsresponseDeserialized = new ViewSubscriptionsResponse(
         viewsubscriptionsresponseSerialized, false);
     assertNotNull(viewsubscriptionsresponseDeserialized);
     assertTrue(isEqual(viewsubscriptionsresponse.toArray(false),
                        viewsubscriptionsresponseDeserialized.toArray(false)));
   },
 });
 