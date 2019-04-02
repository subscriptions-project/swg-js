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
import {PropensityServer} from './propensity-server';
import {Xhr} from '../utils/xhr';
import * as PropensityApi from '../api/propensity-api';
import {parseQueryString} from '../utils/url';

describes.realWin('PropensityServer', {}, env => {
  let win;
  let propensityServer;

  beforeEach(() => {
    win = env.win;
    propensityServer = new PropensityServer(win, 'pub1');
  });

  it('should test sending subscription state', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Publisher not whitelisted'));
        });
    const entitlements = {'product': ['a', 'b', 'c']};
    return propensityServer.sendSubscriptionState(
        PropensityApi.SubscriptionState.SUBSCRIBER,
        JSON.stringify(entitlements)).then(() => {
          throw new Error('must have failed');
        }).catch(reason => {
          const queryString = capturedUrl.split('?')[1];
          const queries = parseQueryString(queryString);
          expect(queries).to.not.be.null;
          expect('cookie' in queries).to.be.true;
          expect(queries['cookie']).to.equal('noConsent');
          expect('states' in queries).to.be.true;
          const userState = 'pub1:' + queries['states'].split(':')[1];
          expect(userState).to.equal('pub1:yes');
          const products = decodeURIComponent(queries['states'].split(':')[2]);
          expect(products).to.equal(JSON.stringify(entitlements));
          expect(capturedRequest.credentials).to.equal('include');
          expect(capturedRequest.method).to.equal('GET');
          expect(() => {throw reason;}).to.throw(/Publisher not whitelisted/);
        });
  });

  it('should test sending event', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Not sent from allowed origin'));
        });
    const eventParam = {'is_active': false, 'offers_shown': ['a', 'b', 'c']};
    return propensityServer.sendEvent(
        PropensityApi.Event.IMPRESSION_PAYWALL,
        JSON.stringify(eventParam)
      ).then(() => {
        throw new Error('must have failed');
      }).catch(reason => {
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.true;
        expect(queries['cookie']).to.equal('noConsent');
        expect('events' in queries).to.be.true;
        const events = decodeURIComponent(queries['events'].split(':')[2]);
        expect(events).to.equal(JSON.stringify(eventParam));
        expect(capturedRequest.credentials).to.equal('include');
        expect(capturedRequest.method).to.equal('GET');
        expect(() => {
          throw reason;
        }).to.throw(/Not sent from allowed origin/);
      });
  });

  it('should test get propensity request failure', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Invalid request'));
        });
    return propensityServer.getPropensity('/hello',
        PropensityApi.PropensityType.GENERAL).then(() => {
          throw new Error('must have failed');
        }).catch(reason => {
          const queryString = capturedUrl.split('?')[1];
          const queries = parseQueryString(queryString);
          expect(queries).to.not.be.null;
          expect('cookie' in queries).to.be.true;
          expect(queries['cookie']).to.equal('noConsent');
          expect('products' in queries).to.be.true;
          expect(queries['products']).to.equal('pub1');
          expect('type' in queries).to.be.true;
          expect(queries['type']).to.equal('general');
          expect(capturedRequest.credentials).to.equal('include');
          expect(capturedRequest.method).to.equal('GET');
          expect(() => {throw reason;}).to.throw(/Invalid request/);
        });
  });

  it('should test get propensity', () => {
    const score = {'values': [42]};
    const response = new Response();
    const mockResponse = sandbox.mock(response);
    mockResponse.expects('json').returns(Promise.resolve(score)).once();
    sandbox.stub(Xhr.prototype, 'fetch',
        () => {
          return Promise.resolve(response);
        });
    return propensityServer.getPropensity('/hello',
        PropensityApi.PropensityType.GENERAL).then(response => {
          expect(response).to.not.be.null;
          expect('values' in response).to.be.true;
          expect(response.values[0]).to.equal(42);
        });
  });

  it('should test getting right clientID with user consent', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Invalid request'));
        });
    PropensityServer.prototype.getGads_ = () => {
      return 'aaaaaa';
    };
    propensityServer.setUserConsent(true);
    return propensityServer.getPropensity(
        '/hello', PropensityApi.PropensityType.GENERAL).then(() => {
          throw new Error('must have failed');
        }).catch(reason => {
          const queryString = capturedUrl.split('?')[1];
          const queries = parseQueryString(queryString);
          expect(queries).to.not.be.null;
          expect('cookie' in queries).to.be.true;
          expect(queries['cookie']).to.equal('aaaaaa');
          expect('products' in queries).to.be.true;
          expect(queries['products']).to.equal('pub1');
          expect('type' in queries).to.be.true;
          expect(queries['type']).to.equal('general');
          expect(capturedRequest.credentials).to.equal('include');
          expect(capturedRequest.method).to.equal('GET');
          expect(() => {throw reason;}).to.throw(/Invalid request/);
        });
  });

  it('should test getting right clientID without cookie', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(Xhr.prototype, 'fetch',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Invalid request'));
        });
    PropensityServer.prototype.getGads_ = () => {
      return null;
    };
    propensityServer.setUserConsent(true);
    return propensityServer.getPropensity(
        '/hello', PropensityApi.PropensityType.GENERAL).then(() => {
          throw new Error('must have failed');
        }).catch(reason => {
          const queryString = capturedUrl.split('?')[1];
          const queries = parseQueryString(queryString);
          expect(queries).to.not.be.null;
          expect('cookie' in queries).to.be.false;
          expect('products' in queries).to.be.true;
          expect(queries['products']).to.equal('pub1');
          expect('type' in queries).to.be.true;
          expect(queries['type']).to.equal('general');
          expect(capturedRequest.credentials).to.equal('include');
          expect(capturedRequest.method).to.equal('GET');
          expect(() => {throw reason;}).to.throw(/Invalid request/);
        });
  });
});
