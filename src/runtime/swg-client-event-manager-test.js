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
import * as EventManagerApi from '../api/swg-client-event-manager-api';
import {SwgClientEventManager} from './swg-client-event-manager';

const DEFAULT_TYPE = AnalyticsEvent.IMPRESSION_AD;
const DEFAULT_ORIGIN = EventOriginator.SWG_CLIENT;
const OTHER_TYPE = AnalyticsEvent.ACTION_PAYMENT_COMPLETE;
const OTHER_ORIGIN = EventOriginator.AMP_CLIENT;
const BAD_VALUE = 'I should throw an error';

/** @type {!EventManagerApi.SwgClientEvent} */
const DEFAULT_EVENT = {
  eventType: DEFAULT_TYPE,
  eventOriginator: DEFAULT_ORIGIN,
  isFromUserAction: null,
  additionalParameters: {},
};

describes.sandboxed('EventManager', {}, () => {
  it('should throw an error for invalid events', () => {
    /** @type {!EventManagerApi.SwgClientEvent} */
    let event = {
      eventType: DEFAULT_TYPE,
      eventOriginator: DEFAULT_ORIGIN,
      isFromUserAction: null,
      additionalParameters: {},
    };
    const eventMan = new SwgClientEventManager();

    let errorCount = 0;
    const tryIt = () => {
      try {
        eventMan.logEvent(event);
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
    event.eventType = DEFAULT_TYPE;

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
    event.eventOriginator = DEFAULT_ORIGIN;

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
    event.isFromUserAction = null;

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
    event.additionalParameters = {};

    //validate null object
    errorCount = 0;
    event = null;
    tryIt();
    expect(errorCount).to.equal(1);
  });

  it('should be able to listen for events', function*() {
    const eventMan = new SwgClientEventManager();
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;

    //verify it can listen to 1
    eventMan.addListener(callback);
    yield eventMan.logEvent(DEFAULT_EVENT);

    expect(receivedEventsCount).to.equal(1);
    //verify it can listen to 2 at the same time
    eventMan.addListener(callback);
    yield eventMan.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(3);
  });

  it('should be able to filter out some events', function*() {
    const eventMan = new SwgClientEventManager();
    let receivedEventsCount = 0;
    const callback = () => receivedEventsCount++;
    eventMan.addListener(callback);

    //filter out the default origin
    eventMan.addFilterer(event =>
      event.eventOriginator === DEFAULT_ORIGIN ?
          EventManagerApi.FilterResult.STOP_EXECUTING :
          EventManagerApi.FilterResult.CONTINUE_EXECUTING
    );

    //ensure the default origin is filtered out
    yield eventMan.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(0);

    //ensure the other origin is not filtered out
    DEFAULT_EVENT.eventOriginator = OTHER_ORIGIN;
    yield eventMan.logEvent(DEFAULT_EVENT);
    expect(receivedEventsCount).to.equal(1);
    eventMan.eventOriginator = DEFAULT_ORIGIN;
  });
});
