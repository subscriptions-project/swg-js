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

import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {GoogleAnalyticsEventListener} from './google-analytics-event-listener';
import {MockDeps} from '../../test/mock-deps';
import {SubscriptionFlows} from '../api/subscriptions';
import {analyticsEventToGoogleAnalyticsEvent} from './event-type-mapping';

describes.realWin('GoogleAnalyticsEventListener', (env) => {
  let win;
  let winMock;
  let eventManager;
  let deps;
  let listener;
  let gtmEventPushFn;

  beforeEach(() => {
    sandbox.stub(self.console, 'log');
    gtmEventPushFn = sandbox.spy();
  });

  afterEach(() => {
    self.console.log.restore();
  });

  function setupEnvironment(wind, callStart, addDataLayer) {
    win = wind;
    if (addDataLayer) {
      win.dataLayer = {
        push: gtmEventPushFn,
      };
    }
    winMock = sandbox.mock(win);
    eventManager = new ClientEventManager(Promise.resolve());
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(win);
    sandbox.stub(deps, 'eventManager').returns(eventManager);
    listener = new GoogleAnalyticsEventListener(deps);
    if (callStart) {
      listener.start();
    }
  }

  it('Should log ga event on valid event (IMPRESSION_OFFERS)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS
    );
    expectEventLoggedToGa(gaEvent);
    expectEventLoggedToGtag(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledOnce;
    winMock.verify();
  });

  it('Should log ga event on valid event (ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK
    );
    expectEventLoggedToGa(gaEvent);
    expectEventLoggedToGtag(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_SWG_SUBSCRIPTION_MINI_PROMPT_CLICK,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledOnce;
    winMock.verify();
  });

  it('Should log contribution pay complete', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      SubscriptionFlows.CONTRIBUTE
    );
    expectEventLoggedToGa(gaEvent);
    expectEventLoggedToGtag(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      additionalParameters: {
        subscriptionFlow: SubscriptionFlows.CONTRIBUTE,
        isUserRegistered: true,
      },
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledOnce;
    winMock.verify();
  });

  it('Should log subscription pay complete', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      SubscriptionFlows.SUBSCRIBE
    );
    expectEventLoggedToGa(gaEvent);
    expectEventLoggedToGtag(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      additionalParameters: {
        subscriptionFlow: SubscriptionFlows.SUBSCRIBE,
        isUserRegistered: true,
      },
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledOnce;
    winMock.verify();
  });

  it('Should log subscription pay complete with EventParams as additionalParams', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      SubscriptionFlows.CONTRIBUTE
    );
    expectEventLoggedToGa(gaEvent);
    expectEventLoggedToGtag(gaEvent);
    const eventParams = new EventParams();
    eventParams.setSubscriptionFlow(SubscriptionFlows.CONTRIBUTE);
    eventParams.setIsUserRegistered(true);
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
      additionalParameters: eventParams,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledOnce;
    winMock.verify();
  });

  it('Should log with additional gaParams and gtagParams', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS
    );
    const gaEventWithParams = Object.assign({}, gaEvent, {
      eventCategory: 'TEST CATEGORY',
      eventLabel: 'TEST LABEL',
    });
    expectEventLoggedToGa(gaEventWithParams);
    winMock
      .expects('gtag')
      .withExactArgs('event', gaEvent.eventAction, {
        'event_category': 'TEST CATEGORY',
        'survey_question': 'TEST QUESTION',
        'survey_answer_category': 'TEST CATEGORY',
        'event_label': 'TEST LABEL',
        'non_interaction': gaEvent.nonInteraction,
      })
      .once();

    const eventParams = {
      googleAnalyticsParameters: {
        'event_category': 'TEST CATEGORY',
        'event_label': 'TEST LABEL',
        'survey_question': 'TEST QUESTION',
        'survey_answer_category': 'TEST CATEGORY',
      },
    };
    eventManager.logEvent(
      {
        eventType: AnalyticsEvent.IMPRESSION_OFFERS,
        eventOriginator: EventOriginator.SWG_CLIENT,
      },
      eventParams
    );
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.be.calledWith({
      'event': gaEvent.eventAction,
      'event_category': 'TEST CATEGORY',
      'survey_question': 'TEST QUESTION',
      'survey_answer_category': 'TEST CATEGORY',
      'event_label': 'TEST LABEL',
      'non_interaction': gaEvent.nonInteraction,
      'configurationId': '',
    });
    winMock.verify();
  });

  it('Should not log pay complete when missing subscriptionFlow', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    winMock.expects('ga').never();
    winMock.expects('gtag').never();
    eventManager.logEvent({
      eventType: AnalyticsEvent.ACTION_PAYMENT_COMPLETE,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.not.have.been.called;
    winMock.verify();
  });

  it('Should not log on invalid event (IMPRESSION_REGWALL)', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    winMock.expects('ga').never();
    winMock.expects('gtag').never();
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_REGWALL,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.not.have.been.called;
    winMock.verify();
  });

  it('Should not log to ga if not present', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS
    );
    expectEventLoggedToGtag(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    // Expect that a TypeError hasn't been thrown.
    expect(self.console.log).to.not.have.been.called;
    expect(gtmEventPushFn).to.be.called;
    winMock.verify();
  });

  it('Should not log to gtag if not present', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ true
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS
    );
    expectEventLoggedToGa(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    // Expect that a TypeError hasn't been thrown.
    expect(self.console.log).to.not.have.been.called;
    expect(gtmEventPushFn).to.be.called;
    winMock.verify();
  });

  it('Should not log to gtm if not present', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ true,
      /* addDataLayer= */ false
    );
    const gaEvent = analyticsEventToGoogleAnalyticsEvent(
      AnalyticsEvent.IMPRESSION_OFFERS
    );
    expectEventLoggedToGtag(gaEvent);
    expectEventLoggedToGa(gaEvent);
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    // Expect that a TypeError hasn't been thrown.
    expect(self.console.log).to.not.have.been.called;
    expect(gtmEventPushFn).to.not.have.been.called;
    winMock.verify();
  });

  it('Should not log if start has not been called', async () => {
    setupEnvironment(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      }),
      /* callStart= */ false,
      /* addDataLayer= */ true
    );
    winMock.expects('ga').never();
    winMock.expects('gtag').never();
    eventManager.logEvent({
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.SWG_CLIENT,
    });
    await eventManager.lastAction_;

    expect(gtmEventPushFn).to.not.have.been.called;
    winMock.verify();
  });

  it('Should be ga eligible', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGaEligible(deps)).to.be.true;
    deps.win.restore();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGaEligible(deps)).to.be.true;
  });

  it('Should be ga ineligible without valid ga', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        gtag: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGaEligible(deps)).to.be.false;
    deps.win.restore();
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(Object.assign({}, env.win));
    expect(GoogleAnalyticsEventListener.isGaEligible(deps)).to.be.false;
  });

  it('Should be gtag eligible', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGtagEligible(deps)).to.be.true;
    deps.win.restore();
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        gtag: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGtagEligible(deps)).to.be.true;
  });

  it('Should be gtag ineligible without valid gtag', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGtagEligible(deps)).to.be.false;
    deps.win.restore();
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(Object.assign({}, env.win));
    expect(GoogleAnalyticsEventListener.isGtagEligible(deps)).to.be.false;
  });

  it('Should be gtm eligible', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
        dataLayer: {
          push: () => {},
        },
      })
    );
    expect(GoogleAnalyticsEventListener.isGtmEligible(deps)).to.be.true;

    deps.win.restore();
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        dataLayer: {
          push: () => {},
        },
      })
    );
    expect(GoogleAnalyticsEventListener.isGtmEligible(deps)).to.be.true;
  });

  it('Should be gtm ineligible without valid dataLayer', async () => {
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGtmEligible(deps)).to.be.false;

    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(
      Object.assign({}, env.win, {
        ga: () => {},
        gtag: () => {},
        dataLayer: {},
      })
    );
    expect(GoogleAnalyticsEventListener.isGtmEligible(deps)).to.be.false;

    deps.win.restore();
    deps = new MockDeps();
    sandbox.stub(deps, 'win').returns(Object.assign({}, env.win));
    expect(GoogleAnalyticsEventListener.isGtmEligible(deps)).to.be.false;
  });

  function expectEventLoggedToGa(gaEvent) {
    winMock.expects('ga').withExactArgs('send', 'event', gaEvent).once();
  }

  function expectEventLoggedToGtag(gaEvent) {
    winMock
      .expects('gtag')
      .withExactArgs('event', gaEvent.eventAction, {
        'event_category': gaEvent.eventCategory,
        'event_label': gaEvent.eventLabel,
        'non_interaction': gaEvent.nonInteraction,
      })
      .once();
  }
});
