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
import {ClientEventManager} from './client-event-manager';
import {DepsDef} from './deps';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';

describes.realWin('GoogleAnalyticsEventListener', {}, (env) => {
  let win;
  let winMock;
  let eventManager;
  let deps;
  let listener;

  beforeEach(() => {
    sandbox.stub(self.console, 'warn');
  });

  afterEach(() => {
    winMock.verify();
    self.console.warn.restore();
  });

  function setupEnvironment(wind, callStart) {
    win = wind;
    winMock = sandbox.mock(win);
    eventManager = new ClientEventManager(Promise.resolve());
    deps = new DepsDef();
    sandbox.stub(deps, 'win').returns(win);
    sandbox.stub(deps, 'eventManager').returns(eventManager);
    listener = new GoogleAnalyticsEventListener(deps);
    if (callStart) {
      listener.start();
    }
  }

  it('Should log to ga on valid event (IMPRESSION_OFFERS)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
      }),
      true
    );
    winMock
      .expects('ga')
      .withExactArgs(
        'send',
        'event',
        analyticsEventToGoogleAnalyticsEvent(AnalyticsEvent.IMPRESSION_OFFERS)
      )
      .once();
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;
  });

  it('Should log to ga on valid event (ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
      }),
      true
    );
    winMock
      .expects('ga')
      .withExactArgs(
        'send',
        'event',
        analyticsEventToGoogleAnalyticsEvent(
          AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK
        )
      )
      .once();
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;
  });

  it('Should not log to ga on invalid event (IMPRESSION_REGWALL)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
      }),
      true
    );
    winMock.expects('ga').never();
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_REGWALL,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;
  });

  it('Should not log if ga not present', async () => {
    setupEnvironment(env.win, true);
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;
    expect(self.console.warn).to.have.been.calledWithExactly(
      '[SwG] Google Analytics function "ga" not found on page. Will not log to Google Analytics.'
    );
  });

  it('Should not log to ga if start has not been called', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
      }),
      false
    );
    winMock.expects('ga').never();
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;
  });
});
