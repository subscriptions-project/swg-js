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
    AnalyticsEvent,
    deserialize} from './api_messages';

/**
 * Compare two protos
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} thisArray
 * @param {!Array<(string|boolean|number|null|!Array<(string|boolean|number|null)>)>} otherArray
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
      analyticscontext.setEmbedderOrigin();
      analyticscontext.setTransactionId();
      analyticscontext.setReferringOrigin();
      analyticscontext.setUtmSource();
      analyticscontext.setUtmName();
      analyticscontext.setUtmMedium();
      analyticscontext.setSku();
      analyticscontext.setReadyToPay(false);
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
      analyticscontext.setEmbedderOrigin();
      analyticscontext.setTransactionId();
      analyticscontext.setReferringOrigin();
      analyticscontext.setUtmSource();
      analyticscontext.setUtmName();
      analyticscontext.setUtmMedium();
      analyticscontext.setSku();
      analyticscontext.setReadyToPay(false);
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
});

