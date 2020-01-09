/**
 * Copyright 2019 The Subscribe with Google Authors. All Rights Reserved.
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
import * as PropensityApi from '../api/propensity-api';
import * as ServiceUrl from './services';
import {
  AnalyticsEvent,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {ClientEventManager} from './client-event-manager';
import {Event, SubscriptionState} from '../api/logger-api';
import {PageConfig} from '../model/page-config';
import {PropensityServer} from './propensity-server';
import {parseQueryString} from '../utils/url';

/**
 * Converts the URL sent to the propensity server into the propensity event
 * that generated the URL.
 * @param {!string} capturedUrl
 * @return {!PropensityApi.PropensityEvent}
 */
function getPropensityEventFromUrl(capturedUrl) {
  const queryString = capturedUrl.split('?')[1];
  const eventsStr = decodeURIComponent(parseQueryString(queryString)['events']);
  const startType = eventsStr.indexOf(':');
  const endType = eventsStr.indexOf(':', startType + 1);
  const eventParam = JSON.parse(eventsStr.substring(endType + 1));
  return /* @typedef {PropensityEvent} */ {
    name: eventsStr.substring(startType + 1, endType),
    active: eventParam['is_active'],
    data: eventParam,
  };
}

describes.realWin('PropensityServer', {}, env => {
  let win;
  let propensityServer;
  let eventManager;
  let registeredCallback;
  let fetcher;
  let pageConfig;
  let defaultEvent;

  const config = {};
  const fakeDeps = {
    eventManager: () => eventManager,
    pageConfig: () => pageConfig,
    config: () => config,
  };
  const serverUrl = 'http://localhost:31862';
  const defaultParameters = {'custom': 'value'};

  const productsOrSkus = {'product': ['a', 'b', 'c']};

  beforeEach(() => {
    win = env.win;
    registeredCallback = null;
    fetcher = {fetch: () => {}};
    eventManager = new ClientEventManager(Promise.resolve());
    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake(callback => (registeredCallback = callback));
    pageConfig = new PageConfig('pub1', true);
    propensityServer = new PropensityServer(win, fakeDeps, fetcher);
    sandbox.stub(ServiceUrl, 'adsUrl').callsFake(url => serverUrl + url);
    defaultEvent = {
      eventType: AnalyticsEvent.IMPRESSION_OFFERS,
      eventOriginator: EventOriginator.PROPENSITY_CLIENT,
      isFromUserAction: null,
      additionalParameters: defaultParameters,
    };
  });

  describe('Subscription State', () => {
    it('should test sending subscription state', async () => {
      let capturedUrl;
      let capturedRequest;
      sandbox.stub(fetcher, 'fetch').callsFake((url, init) => {
        capturedUrl = url;
        capturedRequest = init;
        return Promise.reject(new Error('Publisher not whitelisted'));
      });
      sandbox
        .stub(PropensityServer.prototype, 'getDocumentCookie_')
        .callsFake(() => '__gads=aaaaaa');

      await expect(
        propensityServer.sendSubscriptionState(
          SubscriptionState.SUBSCRIBER,
          JSON.stringify(productsOrSkus)
        )
      ).to.be.rejectedWith(/Publisher not whitelisted/);

      const path = new URL(capturedUrl);
      expect(path.pathname).to.equal('/subopt/data');
      const queryString = capturedUrl.split('?')[1];
      const queries = parseQueryString(queryString);
      expect(queries).to.not.be.null;
      expect('cookie' in queries).to.be.true;
      expect(queries['cookie']).to.equal('aaaaaa');
      expect('v' in queries).to.be.true;
      expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
      expect(queries['cdm']).to.not.be.null;
      expect('states' in queries).to.be.true;
      const userState = 'pub1:' + queries['states'].split(':')[1];
      expect(userState).to.equal('pub1:subscriber');
      const products = decodeURIComponent(queries['states'].split(':')[2]);
      expect(products).to.equal(JSON.stringify(productsOrSkus));
      expect(queries['extrainfo']).to.equal(JSON.stringify(productsOrSkus));
      expect(capturedRequest.credentials).to.equal('include');
      expect(capturedRequest.method).to.equal('GET');
    });

    it('should allow subscription state change via event', () => {
      let receivedState;
      let receivedProducts;
      // Set experiments and config then make a news server with them enabled
      config.enablePropensity = true;
      const event = {
        eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_STATE,
        eventOriginator: EventOriginator.PUBLISHER_CLIENT,
        isFromUserAction: null,
        additionalParameters: {
          'state': SubscriptionState.UNKNOWN,
          'productsOrSkus': JSON.stringify(productsOrSkus),
        },
      };

      sandbox
        .stub(PropensityServer.prototype, 'sendSubscriptionState')
        .callsFake((state, products) => {
          receivedState = state;
          receivedProducts = products;
        });

      registeredCallback(event);
      eventManager.logEvent(event);
      expect(receivedState).to.equal(SubscriptionState.UNKNOWN);
      expect(receivedProducts).to.equal(JSON.stringify(productsOrSkus));
    });
  });

  describe('Communications', () => {
    beforeEach(() => {
      sandbox
        .stub(PropensityServer.prototype, 'getDocumentCookie_')
        .callsFake(() => '__gads=aaaaaa');
    });

    it('should send events', () => {
      let capturedUrl;
      let capturedRequest;
      sandbox.stub(fetcher, 'fetch').callsFake((url, init) => {
        capturedUrl = url;
        capturedRequest = init;
        return Promise.reject(new Error('Not sent from allowed origin'));
      });
      const eventParam = {'is_active': false, 'offers_shown': ['a', 'b', 'c']};
      defaultEvent.additionalParameters = eventParam;
      registeredCallback(defaultEvent);
      const path = new URL(capturedUrl);
      expect(path.pathname).to.equal('/subopt/data');
      const queryString = capturedUrl.split('?')[1];
      const queries = parseQueryString(queryString);
      expect(queries).to.not.be.null;
      expect('cookie' in queries).to.be.true;
      expect(queries['cookie']).to.equal('aaaaaa');
      expect('v' in queries).to.be.true;
      expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
      expect(queries['cdm']).to.not.be.null;
      expect('events' in queries).to.be.true;
      const events = decodeURIComponent(queries['events'].split(':')[2]);
      expect(events).to.equal(JSON.stringify(eventParam));
      expect(queries['extrainfo']).to.equal(JSON.stringify(eventParam));
      expect(capturedRequest.credentials).to.equal('include');
      expect(capturedRequest.method).to.equal('GET');
      defaultEvent.additionalParameters = defaultParameters;
    });

    it('should process failures', async () => {
      let capturedUrl;
      let capturedRequest;
      sandbox.stub(fetcher, 'fetch').callsFake((url, init) => {
        capturedUrl = url;
        capturedRequest = init;
        return Promise.reject(new Error('Invalid request'));
      });

      await expect(
        propensityServer.getPropensity(
          '/hello',
          PropensityApi.PropensityType.GENERAL
        )
      ).to.be.rejectedWith(/Invalid request/);

      const queryString = capturedUrl.split('?')[1];
      const queries = parseQueryString(queryString);
      expect(queries).to.not.be.null;
      expect('cookie' in queries).to.be.true;
      expect(queries['cookie']).to.equal('aaaaaa');
      expect('v' in queries).to.be.true;
      expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
      expect('cdm' in queries).to.be.true;
      expect(queries['cdm']).to.not.be.null;
      expect('products' in queries).to.be.true;
      expect(queries['products']).to.equal('pub1');
      expect('type' in queries).to.be.true;
      expect(queries['type']).to.equal('general');
      expect(capturedRequest.credentials).to.equal('include');
      expect(capturedRequest.method).to.equal('GET');
    });

    it('should listen for events from event manager', () => {
      expect(registeredCallback).to.not.be.null;
    });
  });

  describe('Scores', () => {
    it('should test get propensity bucketed scores', async () => {
      const propensityResponse = {
        'header': {'ok': true},
        'scores': [
          {
            'product': 'pub1',
            'score': 10,
            'score_type': 2,
          },
        ],
      };
      const response = new Response();
      const mockResponse = sandbox.mock(response);
      mockResponse
        .expects('json')
        .returns(Promise.resolve(propensityResponse))
        .once();
      sandbox.stub(fetcher, 'fetch').callsFake(() => Promise.resolve(response));

      const actualResponse = await propensityServer.getPropensity(
        '/hello',
        PropensityApi.PropensityType.GENERAL
      );
      expect(actualResponse).to.not.be.null;
      const header = actualResponse['header'];
      expect(header).to.not.be.null;
      expect(header['ok']).to.be.true;
      const body = actualResponse['body'];
      expect(body).to.not.be.null;
      expect(body['scores']).to.not.be.null;
      const scores = body['scores'];
      expect(scores[0].product).to.equal('pub1');
      expect(scores[0].score.value).to.equal(10);
      expect(scores[0].score.bucketed).to.be.true;
      expect(scores.length).to.equal(1);
    });

    it('should test only get propensity score for pub', async () => {
      const propensityResponse = {
        'header': {'ok': true},
        'scores': [
          {
            'product': 'pub2',
            'score': 90,
          },
          {
            'product': 'pub1:premium',
            'error_message': 'not available',
          },
        ],
      };
      const response = new Response();
      const mockResponse = sandbox.mock(response);
      mockResponse
        .expects('json')
        .returns(Promise.resolve(propensityResponse))
        .once();
      sandbox.stub(fetcher, 'fetch').callsFake(() => Promise.resolve(response));

      const actualResponse = await propensityServer.getPropensity(
        '/hello',
        PropensityApi.PropensityType.GENERAL
      );
      expect(actualResponse).to.not.be.null;
      const header = actualResponse['header'];
      expect(header).to.not.be.null;
      expect(header['ok']).to.be.true;
      const body = actualResponse['body'];
      expect(body).to.not.be.null;
      expect(body['scores'].length).to.not.be.null;
      const scores = body['scores'];
      expect(scores[0].product).to.equal('pub2');
      expect(scores[0].score.value).to.equal(90);
      expect(scores[0].score.bucketed).to.be.false;
      expect(scores[1].product).to.equal('pub1:premium');
      expect(scores[1].error).to.equal('not available');
      expect(scores.length).to.equal(2);
    });

    it('should test no propensity score available', async () => {
      const propensityResponse = {
        'header': {'ok': false},
        'error': 'Service not available',
      };
      const response = new Response();
      const mockResponse = sandbox.mock(response);
      mockResponse
        .expects('json')
        .returns(Promise.resolve(propensityResponse))
        .once();
      sandbox.stub(fetcher, 'fetch').callsFake(() => Promise.resolve(response));

      const actualResponse = await propensityServer.getPropensity(
        '/hello',
        PropensityApi.PropensityType.GENERAL
      );
      expect(actualResponse).to.not.be.null;
      const header = actualResponse['header'];
      expect(header).to.not.be.null;
      expect(header['ok']).to.be.false;
      const body = actualResponse['body'];
      expect(body).to.not.be.null;
      expect(body['error']).to.equal('Service not available');
    });
  });

  describe('ClientId', () => {
    it('should return the document cookies', () => {
      expect(propensityServer.getDocumentCookie_()).to.equal(
        win.document.cookie
      );
    });

    it('should test getting right clientID with user consent', async () => {
      let capturedUrl;
      let capturedRequest;
      sandbox.stub(fetcher, 'fetch').callsFake((url, init) => {
        capturedUrl = url;
        capturedRequest = init;
        return Promise.reject(new Error('Invalid request'));
      });
      PropensityServer.prototype.getDocumentCookie_ = () => '__gads=aaaaaa';

      await expect(
        propensityServer.getPropensity(
          '/hello',
          PropensityApi.PropensityType.GENERAL
        )
      ).to.be.rejectedWith(/Invalid request/);

      const queryString = capturedUrl.split('?')[1];
      const queries = parseQueryString(queryString);
      expect(queries).to.not.be.null;
      expect('cookie' in queries).to.be.true;
      expect(queries['cookie']).to.equal('aaaaaa');
      expect('v' in queries).to.be.true;
      expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
      expect(queries['cdm']).to.not.be.null;
      expect('products' in queries).to.be.true;
      expect(queries['products']).to.equal('pub1');
      expect('type' in queries).to.be.true;
      expect(queries['type']).to.equal('general');
      expect(capturedRequest.credentials).to.equal('include');
      expect(capturedRequest.method).to.equal('GET');
    });

    it('should test getting right clientID without cookie', async () => {
      let capturedUrl;
      let capturedRequest;
      sandbox.stub(fetcher, 'fetch').callsFake((url, init) => {
        capturedUrl = url;
        capturedRequest = init;
        return Promise.reject(new Error('Invalid request'));
      });
      PropensityServer.prototype.getDocumentCookie_ = () =>
        '__someonelsescookie=abcd';

      await expect(
        propensityServer.getPropensity(
          '/hello',
          PropensityApi.PropensityType.GENERAL
        )
      ).to.be.rejectedWith(/Invalid request/);

      const path = new URL(capturedUrl);
      expect(path.pathname).to.equal('/subopt/pts');
      const queryString = capturedUrl.split('?')[1];
      const queries = parseQueryString(queryString);
      expect(queries).to.not.be.null;
      expect('cookie' in queries).to.be.false;
      expect('v' in queries).to.be.true;
      expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
      expect(queries['cdm']).to.not.be.null;
      expect('products' in queries).to.be.true;
      expect(queries['products']).to.equal('pub1');
      expect('type' in queries).to.be.true;
      expect(queries['type']).to.equal('general');
      expect(capturedRequest.credentials).to.equal('include');
      expect(capturedRequest.method).to.equal('GET');
    });
  });

  describe('Originators', () => {
    // Data about events transmitted by propensity-server
    let receivedType = null;
    let receivedContext = null;

    /**
     * @param {!EventOriginator} originator
     * @param {boolean} expectTransmit
     */
    function testOriginator(originator, expectTransmit) {
      defaultEvent.eventOriginator = originator;
      receivedType = null;
      receivedContext = null;

      registeredCallback(defaultEvent);
      if (expectTransmit) {
        expect(receivedType).to.equal(Event.IMPRESSION_OFFERS);
        expect(receivedContext).to.deep.equal(
          defaultEvent.additionalParameters
        );
      } else {
        expect(receivedType).to.be.null;
        expect(receivedContext).to.be.null;
      }
    }

    beforeEach(() => {
      config.enablePropensity = false;
      sandbox.stub(fetcher, 'fetch').callsFake(url => {
        const event = getPropensityEventFromUrl(url);
        receivedType = event.name;
        receivedContext = event.data;
        return Promise.reject('Server down');
      });
    });

    it('should always send propensity events', () => {
      testOriginator(EventOriginator.PROPENSITY_CLIENT, true);
      config.enablePropensity = true;
      testOriginator(EventOriginator.PROPENSITY_CLIENT, true);
    });

    it('should not send SwG events to Propensity Service', () => {
      testOriginator(EventOriginator.SWG_CLIENT, false);
      testOriginator(EventOriginator.AMP_CLIENT, false);
    });

    it('should send SwG events to the Propensity Service', () => {
      config.enablePropensity = true;

      testOriginator(EventOriginator.SWG_CLIENT, true);
      testOriginator(EventOriginator.AMP_CLIENT, true);
    });
  });

  describe('Additional Parameters', () => {
    let receivedAdditionalParameters;

    beforeEach(() => {
      receivedAdditionalParameters = null;
      sandbox
        .stub(propensityServer, 'sendEvent_')
        .callsFake((eventTypeUnused, additionalParameters) => {
          receivedAdditionalParameters = additionalParameters
            ? JSON.parse(additionalParameters)
            : undefined;
        });
    });

    it('should process random objects', () => {
      const addParams = {value: 'aValue'};
      defaultEvent.additionalParameters = addParams;
      registeredCallback(defaultEvent);
      expect(receivedAdditionalParameters).to.deep.equal(addParams);
    });

    it('should not process EventParams', () => {
      const addParams = new EventParams();
      defaultEvent.additionalParameters = addParams;
      registeredCallback(defaultEvent);
      expect(receivedAdditionalParameters).to.be.undefined;
    });
  });
});
