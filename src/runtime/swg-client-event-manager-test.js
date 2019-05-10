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

import {AnalyticsEvent,EventOriginator} from '../proto/api_messages';
import {SwgClientEventManager, FilterResult} from './swg-client-event-manager';

const DEFAULT_TYPE = AnalyticsEvent.IMPRESSION_AD;
const DEFAULT_ORIGIN = EventOriginator.SWG_CLIENT;
const OTHER_TYPE = AnalyticsEvent.ACTION_PAYMENT_COMPLETE;
const OTHER_ORIGIN = EventOriginator.AMP_CLIENT;
const BAD_VALUE = 'I should throw an error';

/** @type {SwgClientEvent} */
const DEFAULT_EVENT = {
  eventType: DEFAULT_TYPE,
  eventOriginator: DEFAULT_ORIGIN,
  isFromUserAction: null,
  additionalParameters: {},
};


describes.sandboxed('SwgClientEvent', {}, () => {
  it('should properly validate events', () => {
    /** @type {SwgClientEvent} */
    const event = {
      eventType: DEFAULT_TYPE,
      eventOriginator: DEFAULT_ORIGIN,
      isFromUserAction: null,
      additionalParameters: {},
    };
    let errorCount = 0;
    const tryIt = () => {
      try {
        SwgClientEventManager.validateEvent(event);
      } catch (e) {
        errorCount++;
      }
    };
    tryIt();
    expect(errorCount).to.equal(0);

    //validate event type
    event.eventType = BAD_VALUE;
    tryIt();
    expect(errorCount).to.equal(1);
    event.eventType = null;
    tryIt();
    expect(errorCount).to.equal(2);
    event.eventType = OTHER_TYPE;
    tryIt();
    expect(errorCount).to.equal(2);

    //validate event originator
    errorCount = 0;
    event.eventOriginator = BAD_VALUE;
    tryIt();
    expect(errorCount).to.equal(1);
    event.eventOriginator = null;
    tryIt();
    expect(errorCount).to.equal(2);
    event.eventOriginator = OTHER_ORIGIN;
    tryIt();
    expect(errorCount).to.equal(2);

    //validate isFromUserAction
    errorCount = 0;
    event.isFromUserAction = BAD_VALUE;
    tryIt();
    expect(errorCount).to.equal(1);
    event.isFromUserAction = true;
    tryIt();
    expect(errorCount).to.equal(1);
    event.isFromUserAction = false;
    tryIt();
    expect(errorCount).to.equal(1);

    //validate additionalParameters
    errorCount = 0;
    event.additionalParameters = BAD_VALUE;
    tryIt();
    expect(errorCount).to.equal(1);
    event.additionalParameters = null;
    tryIt();
    expect(errorCount).to.equal(1);
    event.additionalParameters = {IAmValid: 5};
    tryIt();
    expect(errorCount).to.equal(1);
  });
});

describes.sandboxed('EventManager', {}, () => {
  it('should not allow invalid events', () => {
    try {
      SwgClientEventManager.logEvent({});
    } catch (e) {
      return;
    }
    //throwing an error above is the expected result so this always fails:
    expect(5).to.be.null;
  });

  it('should be able to listen for events', () => {
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //verify it can listen to 1
    SwgClientEventManager.addListener(callback);
    SwgClientEventManager.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(1);

    //verify it can listen to 2 at the same time
    SwgClientEventManager.addListener(callback);
    SwgClientEventManager.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(3);
    SwgClientEventManager.clear();
  });

  it('should be able to filter out some events', () => {
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //filter out the default origin
    SwgClientEventManager.addFilterer(event => event.eventOriginator
        === DEFAULT_ORIGIN ?
        FilterResult.STOP_EXECUTING : FilterResult.CONTINUE_EXECUTING
    );
    SwgClientEventManager.addListener(callback);
    SwgClientEventManager.logEvent(DEFAULT_EVENT);
    //ensure the filtering is respected
    expect(receivedEventsCount).to.equal(0);

    //ensure it passes through the filter
    DEFAULT_EVENT.eventOriginator = OTHER_ORIGIN;
    SwgClientEventManager.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(1);
    DEFAULT_EVENT.eventOriginator = DEFAULT_ORIGIN;
    SwgClientEventManager.clear();
  });
});
