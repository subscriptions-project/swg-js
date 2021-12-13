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

 import {ActivityIframePort} from '../components/activities';
 import {
    AnalyticsEvent,
    AudienceActivityClientLogsRequest,
    EventOriginator,
    EventParams,
  } from '../proto/api_messages';
  import {ClientEventManager} from './client-event-manager';
  import {DepsDef} from './deps';
  import {AudienceActivityEventListener} from './audience-activity-listener';
  import {XhrFetcher} from './fetcher';
  import {ConfiguredRuntime} from './runtime';
  import {ExperimentFlags} from './experiment-flags';
  import {PageConfig} from '../model/page-config';
  import {setExperimentsStringForTesting} from './experiments';
  import {SubscriptionFlows} from '../api/subscriptions';

  const URL = 'www.news.com';
  
  describes.realWin('AudienceActivityEventListener', {}, (env) => {
    let src;
    let activityPorts;
    let activityIframePort;
    let pageConfig;
    let runtime;
    let eventManagerCallback;
    let audienceActivityEventListener;
    let pretendPortWorks;
    let loggedErrors;
    let eventsLoggedToService;
    let listener;
  
    const defEventType = AnalyticsEvent.IMPRESSION_PAYWALL;
    const productId = 'pub1:label1';
  
    beforeEach(() => {
        setExperimentsStringForTesting('');
        eventsLoggedToService = [];


    // Work around `location.search` being non-configurable,
    // which means Sinon can't stub it normally.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_redefine_property
    env.win = Object.assign({}, env.win, {
      location: {
        search: '?utm_source=scenic&utm_medium=email&utm_campaign=campaign',
      },
    });

    sandbox
      .stub(env.win.document, 'referrer')
      .get(() => 'https://scenic-2017.appspot.com/landing.html');

    sandbox
      .stub(XhrFetcher.prototype, 'sendBeacon')
      .callsFake((unusedUrl, message) => {
        eventsLoggedToService.push(message);
      });

    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake((callback) => (eventManagerCallback = callback));

    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(env.win, pageConfig);
    sandbox.stub(runtime.doc(), 'getRootNode').callsFake(() => {
      return {
        querySelector: () => {
          return {href: URL};
        },
      };
    });
    audienceActivityEventListener = new AudienceActivityEventListener(runtime, runtime.fetcher_);
    });

    describe('Audience Activity Events Experiment', () => {
      
        it('should not log audience activity events if experiment is off', async () => {
          // This triggers an event.
          eventManagerCallback({
            eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
            eventOriginator: EventOriginator.UNKNOWN_CLIENT,
            isFromUserAction: null,
            additionalParameters: null,
          });
  
          // These wait for analytics server to be ready to send data.
          expect(audienceActivityEventListener.lastAction_).to.not.be.null;
          await audienceActivityEventListener.lastAction_;
          // await audienceActivityEventListener.whenReady();
  
          // expectOpenIframe = true;
          expect(eventsLoggedToService.length).to.equal(0);
        });
  
        it('should log audience activity events if experiment is turned on', async () => {
          setExperimentsStringForTesting(ExperimentFlags.LOGGING_AUDIENCE_ACTIVITY);
          audienceActivityEventListener.start();
          // This triggers an event.
          eventManagerCallback({
            eventType: AnalyticsEvent.IMPRESSION_PAYWALL,
            eventOriginator: EventOriginator.UNKNOWN_CLIENT,
            isFromUserAction: null,
            additionalParameters: null,
          });

          // These wait for analytics server to be ready to send data.
          expect(audienceActivityEventListener.lastAction_).to.not.be.null;
          await audienceActivityEventListener.lastAction_;
          // await activityIframePort.whenReady();
  
          // expectOpenIframe = true;
          console.log("katTest2");
          expect(eventsLoggedToService.length).to.equal(1);
        });
      });
});