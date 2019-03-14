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
import {XhrInterface} from './propensity-server';
import * as PropensityApi from '../api/propensity-api';
import {parseQueryString} from '../utils/url';
import * as sinon from 'sinon';
import {parseJson} from '../utils/json';

describes.realWin('XhrInterface', {}, () => {
  let errorMap;
  let xhrInterface;
  const url = '/hello';
  const init = {
    method: 'GET',
    credentials: 'include',
    headers: {'Accept': 'text/plain, application/json'},
  };
  let server;

  beforeEach(() => {
    errorMap = {
      404: 'Publisher not whitelisted',
      403: 'Invalid origin',
      400: 'Invalid request',
      500: 'Server not available',
    };
    server = sinon.fakeServer.create();
    xhrInterface = new XhrInterface(errorMap);
  });

  afterEach(() => {
    server.restore();
  });

  it('should return publisher not whitelisted error', function(done) {
    const errorResponse = [404, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 404, message: 'Not found'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Publisher not whitelisted/);
    });
    server.respond();
    done();
  });

  it('should return invalid origin error', function(done) {
    const errorResponse = [403, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 403, message: 'Invalid origin'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Invalid origin/);
    });
    server.respond();
    done();
  });

  it('should return invalid request error', function(done) {
    const errorResponse = [400, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 400, message: 'Invalid request'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Invalid request/);
    });
    server.respond();
    done();
  });

  it('should return server unavailable error', function(done) {
    const errorResponse = [500, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 500, message: 'Server not available'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Server not available/);
    });
    server.respond();
    done();
  });

  it('should return server unavailable error', function(done) {
    const errorResponse = [500, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 500, message: 'Server not available'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Server not available/);
    });
    server.respond();
    done();
  });

  it('should return server unavailable error', function(done) {
    const errorResponse = [500, {
      'Content-type': 'application/json',
    }, JSON.stringify({error: 500, message: 'Server not available'})];
    server.respondWith('GET', url, errorResponse);
    xhrInterface.sendRequest(url, init).then(() => {
      throw new Error('must have failed');
    }).catch(reason => {
      expect(() => {throw reason;}).to.throw(/Server not available/);
    });
    server.respond();
    done();
  });

  it('should return propensity score', function(done) {
    const propensityResonponse = [200, {
      'Content-type': 'text/plain',
    }, JSON.stringify({'values': [42]})];
    server.respondWith('GET', url, propensityResonponse);
    xhrInterface.sendRequest(url, init).then(response => {
      expect(response).to.not.be.null;
      const score = parseJson(response.responseText);
      expect(score.values == null).to.be.false;
      expect(score.values[0]).to.equal(42);
    });
    server.respond();
    done();
  });

  it('should provide ok response', function(done) {
    const okResonponse = [204, {
      'Content-type': 'text/plain',
    }, ''];
    server.respondWith('GET', url, okResonponse);
    xhrInterface.sendRequest(url, init).then(response => {
      expect(response).to.not.be.null;
      expect(response.ok).to.be.true;
    });
    server.respond();
    done();
  });
});

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
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Publisher not whitelisted'));
        });
    return propensityServer.sendSubscriptionState(
        PropensityApi.SubscriptionState.UNKNOWN).then(() => {
          throw new Error('must have failed');
        }).catch(reason => {
          const queryString = capturedUrl.split('?')[1];
          const queries = parseQueryString(queryString);
          expect(queries).to.not.be.null;
          expect('cookie' in queries).to.be.true;
          expect(queries['cookie']).to.equal('noConsent');
          expect('states' in queries).to.be.true;
          expect(queries['states']).to.equal('pub1:na');
          expect(capturedRequest.credentials).to.equal('include');
          expect(capturedRequest.method).to.equal('GET');
          expect(() => {throw reason;}).to.throw(/Publisher not whitelisted/);
        });
  });

  it('should test sending event', () => {
    let capturedUrl;
    let capturedRequest;
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
        (url, init) => {
          capturedUrl = url;
          capturedRequest = init;
          return Promise.reject(new Error('Not sent from allowed origin'));
        });
    return propensityServer.sendEvent(
        PropensityApi.Event.IMPRESSION_PAYWALL,
        {'is_active': false}
      ).then(() => {
        throw new Error('must have failed');
      }).catch(reason => {
        const queryString = capturedUrl.split('?')[1];
        const queries = parseQueryString(queryString);
        expect(queries).to.not.be.null;
        expect('cookie' in queries).to.be.true;
        expect(queries['cookie']).to.equal('noConsent');
        expect('events' in queries).to.be.true;
        const eventParam = JSON.stringify({'is_active': false});
        expect(queries['events']).to.equal('pub1:paywall:' + eventParam);
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
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
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
    const response = new Response();
    response.ok = true;
    response.responseText = JSON.stringify({'values': [42]});
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
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
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
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
    sandbox.stub(XhrInterface.prototype, 'sendRequest',
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
          console.log('queries', queries);
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
