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
import {PropensityServer} from './propensity-server';
import {Xhr} from '../utils/xhr';
import * as PropensityApi from '../api/propensity-api';
import {Event, SubscriptionState} from '../api/logger-api';
import {parseQueryString} from '../utils/url';
import * as ServiceUrl from './services';
import {ClientEventManager} from './client-event-manager';
import {AnalyticsEvent, EventOriginator} from '../proto/api_messages';
import {setExperiment} from './experiments';
import {ExperimentFlags} from './experiment-flags';

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
  const serverUrl = 'http://localhost:31862';
  const pubId = 'pub1';
  const defaultParameters = {'custom': 'value'};
  const defaultEvent = {
    eventType: AnalyticsEvent.IMPRESSION_OFFERS,
    eventOriginator: EventOriginator.PROPENSITY_CLIENT,
    isFromUserAction: null,
    additionalParameters: defaultParameters,
  };
  const productsOrSkus = {'product': ['a', 'b', 'c']};

  beforeEach(() => {
    win = env.win;
    registeredCallback = null;
    eventManager = new ClientEventManager();
    sandbox
      .stub(ClientEventManager.prototype, 'registerEventListener')
      .callsFake(callback => (registeredCallback = callback));
    propensityServer = new PropensityServer(win, pubId, eventManager);
    sandbox.stub(ServiceUrl, 'adsUrl').callsFake(url => serverUrl + url);
    defaultEvent.eventType = AnalyticsEvent.IMPRESSION_OFFERS;
  });

  it('should listen for events from event manager', function*() {
    expect(registeredCallback).to.not.be.null;
  });

  it('should test sending subscription state', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      capturedUrl = url;
      capturedRequest = init;
      return Promise.reject(new Error('Publisher not whitelisted'));
    });
    PropensityServer.prototype.getDocumentCookie_ = () => {
      return '__gads=aaaaaa';
    };
    PropensityServer.prototype.getReferrer_ = () => {
      return 'https://scenic-2017.appspot.com/landing.html';
    };
    return propensityServer
      .sendSubscriptionState(
        SubscriptionState.SUBSCRIBER,
        JSON.stringify(productsOrSkus)
      )
      .then(() => {
        throw new Error('must have failed');
      })
      .catch(reason => {
        const path = new URL(capturedUrl);
        expect(path.pathname).to.equal('/subopt/data');
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.true;
        expect(queries['cookie']).to.equal('aaaaaa');
        expect('v' in queries).to.be.true;
        expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
        expect(queries['cdm']).to.equal('https://scenic-2017.appspot.com');
        expect('states' in queries).to.be.true;
        const userState = 'pub1:' + queries['states'].split(':')[1];
        expect(userState).to.equal('pub1:subscriber');
        const products = decodeURIComponent(queries['states'].split(':')[2]);
        expect(products).to.equal(JSON.stringify(productsOrSkus));
        expect(capturedRequest.credentials).to.equal('include');
        expect(capturedRequest.method).to.equal('GET');
        expect(() => {
          throw reason;
        }).to.throw(/Publisher not whitelisted/);
      });
  });

  it('should test sending event', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      capturedUrl = url;
      capturedRequest = init;
      return Promise.reject(new Error('Not sent from allowed origin'));
    });
    PropensityServer.prototype.getDocumentCookie_ = () => {
      return '__gads=aaaaaa';
    };
    PropensityServer.prototype.getReferrer_ = () => {
      return null;
    };
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
    expect('cdm' in queries).to.be.false;
    expect('events' in queries).to.be.true;
    const events = decodeURIComponent(queries['events'].split(':')[2]);
    expect(events).to.equal(JSON.stringify(eventParam));
    expect(capturedRequest.credentials).to.equal('include');
    expect(capturedRequest.method).to.equal('GET');
    defaultEvent.additionalParameters = defaultParameters;
  });

  it('should test get propensity request failure', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      capturedUrl = url;
      capturedRequest = init;
      return Promise.reject(new Error('Invalid request'));
    });
    PropensityServer.prototype.getDocumentCookie_ = () => {
      return '__gads=aaaaaa';
    };
    PropensityServer.prototype.getReferrer_ = () => {
      return 'https://scenic-2017.appspot.com/landing.html';
    };
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(() => {
        throw new Error('must have failed');
      })
      .catch(reason => {
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.true;
        expect(queries['cookie']).to.equal('aaaaaa');
        expect('v' in queries).to.be.true;
        expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
        expect(queries['cdm']).to.equal('https://scenic-2017.appspot.com');
        expect('products' in queries).to.be.true;
        expect(queries['products']).to.equal('pub1');
        expect('type' in queries).to.be.true;
        expect(queries['type']).to.equal('general');
        expect(capturedRequest.credentials).to.equal('include');
        expect(capturedRequest.method).to.equal('GET');
        expect(() => {
          throw reason;
        }).to.throw(/Invalid request/);
      });
  });

  it('should test get propensity bucketed scores', () => {
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
    sandbox.stub(Xhr.prototype, 'fetch').callsFake(() => {
      return Promise.resolve(response);
    });
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(response => {
        expect(response).to.not.be.null;
        const header = response['header'];
        expect(header).to.not.be.null;
        expect(header['ok']).to.be.true;
        const body = response['body'];
        expect(body).to.not.be.null;
        expect(body['scores']).to.not.be.null;
        const scores = body['scores'];
        expect(scores[0].product).to.equal('pub1');
        expect(scores[0].score.value).to.equal(10);
        expect(scores[0].score.bucketed).to.be.true;
        expect(scores.length).to.equal(1);
      });
  });

  it('should test only get propensity score for pub', () => {
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
    sandbox.stub(Xhr.prototype, 'fetch').callsFake(() => {
      return Promise.resolve(response);
    });
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(response => {
        expect(response).to.not.be.null;
        const header = response['header'];
        expect(header).to.not.be.null;
        expect(header['ok']).to.be.true;
        const body = response['body'];
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
  });

  it('should test no propensity score available', () => {
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
    sandbox.stub(Xhr.prototype, 'fetch').callsFake(() => {
      return Promise.resolve(response);
    });
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(response => {
        expect(response).to.not.be.null;
        const header = response['header'];
        expect(header).to.not.be.null;
        expect(header['ok']).to.be.false;
        const body = response['body'];
        expect(body).to.not.be.null;
        expect(body['error']).to.equal('Service not available');
      });
  });

  it('should test getting right clientID with user consent', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      capturedUrl = url;
      capturedRequest = init;
      return Promise.reject(new Error('Invalid request'));
    });
    PropensityServer.prototype.getDocumentCookie_ = () => {
      return '__gads=aaaaaa';
    };
    PropensityServer.prototype.getReferrer_ = () => {
      return 'https://scenic-2017.appspot.com/landing.html';
    };
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(() => {
        throw new Error('must have failed');
      })
      .catch(reason => {
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.true;
        expect(queries['cookie']).to.equal('aaaaaa');
        expect('v' in queries).to.be.true;
        expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
        expect(queries['cdm']).to.equal('https://scenic-2017.appspot.com');
        expect('products' in queries).to.be.true;
        expect(queries['products']).to.equal('pub1');
        expect('type' in queries).to.be.true;
        expect(queries['type']).to.equal('general');
        expect(capturedRequest.credentials).to.equal('include');
        expect(capturedRequest.method).to.equal('GET');
        expect(() => {
          throw reason;
        }).to.throw(/Invalid request/);
      });
  });

  it('should test getting right clientID without cookie', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake((url, init) => {
      capturedUrl = url;
      capturedRequest = init;
      return Promise.reject(new Error('Invalid request'));
    });
    PropensityServer.prototype.getDocumentCookie_ = () => {
      return '__someonelsescookie=abcd';
    };
    PropensityServer.prototype.getReferrer_ = () => {
      return 'https://scenic-2017.appspot.com/landing.html';
    };
    return propensityServer
      .getPropensity('/hello', PropensityApi.PropensityType.GENERAL)
      .then(() => {
        throw new Error('must have failed');
      })
      .catch(reason => {
        const path = new URL(capturedUrl);
        expect(path.pathname).to.equal('/subopt/pts');
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.false;
        expect('v' in queries).to.be.true;
        expect(parseInt(queries['v'], 10)).to.equal(propensityServer.version_);
        expect(queries['cdm']).to.equal('https://scenic-2017.appspot.com');
        expect('products' in queries).to.be.true;
        expect(queries['products']).to.equal('pub1');
        expect('type' in queries).to.be.true;
        expect(queries['type']).to.equal('general');
        expect(capturedRequest.credentials).to.equal('include');
        expect(capturedRequest.method).to.equal('GET');
        expect(() => {
          throw reason;
        }).to.throw(/Invalid request/);
      });
  });

  it('should not send SwG events to Propensity Service', () => {
    //stub to ensure the server received a request to log
    let receivedType = null;
    let receivedContext = null;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake(url => {
      const event = getPropensityEventFromUrl(url);
      receivedType = event.name;
      receivedContext = event.data;
      return Promise.reject('Server down');
    });

    //no experiment set & not activated
    defaultEvent.eventOriginator = EventOriginator.SWG_CLIENT;
    registeredCallback(defaultEvent);
    expect(receivedType).to.be.null;
    expect(receivedContext).to.be.null;

    defaultEvent.eventOriginator = EventOriginator.AMP_CLIENT;
    registeredCallback(defaultEvent);
    expect(receivedType).to.be.null;
    expect(receivedContext).to.be.null;

    //activated but no experiment
    propensityServer.enableLoggingSwgEvents();
    registeredCallback(defaultEvent);
    expect(receivedType).to.be.null;
    expect(receivedContext).to.be.null;

    defaultEvent.eventOriginator = EventOriginator.SWG_CLIENT;
    registeredCallback(defaultEvent);
    expect(receivedType).to.be.null;
    expect(receivedContext).to.be.null;

    //experiment but not activated
    setExperiment(win, ExperimentFlags.LOG_SWG_TO_PROPENSITY, true);
    registeredCallback = null;
    propensityServer = new PropensityServer(win, pubId, eventManager);
    registeredCallback(defaultEvent);
    expect(receivedType).to.be.null;
    expect(receivedContext).to.be.null;
    setExperiment(win, ExperimentFlags.LOG_SWG_TO_PROPENSITY, false);
  });

  it('should send SwG events to the Propensity Service', () => {
    //stub to ensure the server received a request to log
    let receivedType = null;
    let receivedContext = null;
    sandbox.stub(Xhr.prototype, 'fetch').callsFake(url => {
      const event = getPropensityEventFromUrl(url);
      receivedType = event.name;
      receivedContext = event.data;
      return Promise.reject('Server down');
    });

    setExperiment(win, ExperimentFlags.LOG_SWG_TO_PROPENSITY, true);
    registeredCallback = null;
    propensityServer = new PropensityServer(win, pubId, eventManager);

    //both experiment and enable: ensure it actually logs
    propensityServer.enableLoggingSwgEvents();
    registeredCallback(defaultEvent);
    expect(receivedType).to.equal(Event.IMPRESSION_OFFERS);
    expect(receivedContext).to.deep.equal(defaultEvent.additionalParameters);

    receivedType = null;
    receivedContext = null;
    defaultEvent.eventOriginator = EventOriginator.AMP_CLIENT;
    registeredCallback(defaultEvent);
    expect(receivedType).to.equal(Event.IMPRESSION_OFFERS);
    expect(receivedContext).to.deep.equal(defaultEvent.additionalParameters);
    setExperiment(win, ExperimentFlags.LOG_SWG_TO_PROPENSITY, false);
  });

  it('should allow subscription state change via event', () => {
    let receivedState;
    let receivedProducts;

    sandbox
      .stub(PropensityServer.prototype, 'sendSubscriptionState')
      .callsFake((state, products) => {
        receivedState = state;
        receivedProducts = products;
      });
    eventManager.logEvent({
      eventType: AnalyticsEvent.EVENT_SUBSCRIPTION_STATE,
      eventOriginator: EventOriginator.PUBLISHER_CLIENT,
      isFromUserAction: null,
      additionalParameters: {
        'state': SubscriptionState.UNKNOWN,
        'productsOrSkus': JSON.stringify(productsOrSkus),
      },
    });
    expect(receivedState).to.equal(SubscriptionState.UNKNOWN);
    expect(receivedProducts).to.equal(JSON.stringify(productsOrSkus));
  });
});
