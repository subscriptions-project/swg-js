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
  AnalyticsContext,
  AnalyticsRequest,
  NativeFlow,
  OfferSelected,
  UserSubscribed,
  AnalyticsEvent,
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
  if (Array.isArray(thisArray[i])) {
    if (!Array.isArray(otherArray[i])) {
      return false;
    }
    const arr = thisArray[i];
    const otherArr = otherArray[i];
    if (arr.length != otherArr.length) {
      return false;
    }
    for (let j = 0; j < arr.length; j++) {
      if (arr[j] != otherArr[j]) {
        return false;
      }
    }
  } else {
    if (thisArray[i] != otherArray[i]) {
      return false;
    }
  }
}
return true;
}


describe('api_messages', () => {

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
    const analyticsrequestSerialized = analyticsrequest.toArray();
    const analyticsrequestDeserialized = deserialize(
        analyticsrequestSerialized);
    expect(analyticsrequestDeserialized).to.not.be.null;
    expect(isEqual(analyticsrequest.toArray(),
        analyticsrequestDeserialized.toArray())).to.be.true;
  });
});

describe('test_NativeFlow', () => {
  it('should deserialize correctly', () => {
    const /** !NativeFlow  */ nativeflow = new NativeFlow();
    nativeflow.setNative(false);
    const nativeflowSerialized = nativeflow.toArray();
    const nativeflowDeserialized = deserialize(
        nativeflowSerialized);
    expect(nativeflowDeserialized).to.not.be.null;
    expect(isEqual(nativeflow.toArray(),
        nativeflowDeserialized.toArray())).to.be.true;
  });
});

describe('test_OfferSelected', () => {
  it('should deserialize correctly', () => {
    const /** !OfferSelected  */ offerselected = new OfferSelected();
    offerselected.setSku('');
    const offerselectedSerialized = offerselected.toArray();
    const offerselectedDeserialized = deserialize(
        offerselectedSerialized);
    expect(offerselectedDeserialized).to.not.be.null;
    expect(isEqual(offerselected.toArray(),
        offerselectedDeserialized.toArray())).to.be.true;
  });
});

describe('test_UserSubscribed', () => {
  it('should deserialize correctly', () => {
    const /** !UserSubscribed  */ usersubscribed = new UserSubscribed();
    usersubscribed.setAlreadySubscribed(false);
    usersubscribed.setLinkRequested(false);
    const usersubscribedSerialized = usersubscribed.toArray();
    const usersubscribedDeserialized = deserialize(
        usersubscribedSerialized);
    expect(usersubscribedDeserialized).to.not.be.null;
    expect(isEqual(usersubscribed.toArray(),
        usersubscribedDeserialized.toArray())).to.be.true;
  });
});
});
