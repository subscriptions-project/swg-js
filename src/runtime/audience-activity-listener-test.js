/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {AudienceActivityEventListener} from './audience-activity-listener';
import {ClientEventManager} from './client-event-manager';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {StorageKeys} from '../utils/constants';
import {XhrFetcher} from './fetcher';
import {setExperimentsStringForTesting} from './experiments';

describes.realWin('AudienceActivityEventListener', (env) => {
  let audienceActivityEventListener;
  let capturedUrl;
  let eventManagerCallback;
  let eventsLoggedToService;
  let pageConfig;
  let runtime;
  let storageMock;

  const productId = 'pub1:label1';

  beforeEach(() => {
    setExperimentsStringForTesting('');
    eventsLoggedToService = [];
    sandbox
      .stub(XhrFetcher.prototype, 'sendBeacon')
      .callsFake((url, message) => {
        eventsLoggedToService.push(message);
        capturedUrl = url;
      });
    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake((callback) => (eventManagerCallback = callback));
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(env.win, pageConfig);
    storageMock = sandbox.mock(runtime.storage());
    audienceActivityEventListener = new AudienceActivityEventListener(
      runtime,
      runtime.fetcher_
    );
  });

  afterEach(() => {
    storageMock.verify();
    sandbox.restore();
  });

  it('should log audience activity events', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.USER_TOKEN, true)
      .resolves('ab+c').once;
    audienceActivityEventListener.start();

    // This triggers an event.
    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });
    expect(eventsLoggedToService.length).to.equal(1);
    expect(eventsLoggedToService[0].getEvent()).to.equal(
      AnalyticsEvent.IMPRESSION_PAYWALL
    );

    const path = new URL(capturedUrl);
    expect(path.toString()).to.equal(
      'https://news.google.com/swg/_/api/v1/publication/pub1/audienceactivity?sut=ab%2Bc'
    );
  });

  it('bails if SUT is unavailable', async () => {
    storageMock
      .expects('get')
      .withExactArgs(StorageKeys.USER_TOKEN, true)
      .resolves(null).once;
    audienceActivityEventListener.start();

    // This triggers an event.
    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    // If the SUT is missing, the listener bails before logging events.
    expect(eventsLoggedToService.length).to.equal(0);
  });

  it('should not log an event that is not classified as an audience activity event', async () => {
    audienceActivityEventListener.start();
    storageMock.expects('get').never();

    // This triggers an event.
    await eventManagerCallback({
      eventType: AnalyticsEvent.IMPRESSION_AD,
      eventOriginator: EventOriginator.UNKNOWN_CLIENT,
      isFromUserAction: null,
      additionalParameters: null,
    });

    expect(eventsLoggedToService.length).to.equal(0);
  });
});
