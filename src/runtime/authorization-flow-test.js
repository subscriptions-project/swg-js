/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {AuthorizationFlow} from './authorization-flow';
import {SubscriptionMarkup} from './subscription-markup';
import {SubscriptionState} from './subscription-state';
import {map} from '../utils/object';
import {isObject} from '../utils/types';


describes.realWin('authorization flow', {}, env => {
  let win;
  let authFlow;
  let markup;
  let state;
  const validConfig = JSON.stringify(
      {
        'profiles': {
          'offer': {
            'services': [
              {
                'id': 'publisher.com',
                'authorizationUrl': 'http://foo.com',
              },
            ],
          },
        },
      });

  const configWithMultipleSP = {
    'profiles': {
      'offer': {
        'services': [
          {
            'id': 'publisher.com',
            'authorizationUrl': 'http://foo.com',
          },
          {
            'id': 'foobar.com',
            'authorizationUrl': 'http://foobar.com',
          },
          {
            'id': 'baz.com',
            'authorizationUrl': 'http://baz.com',
          },
        ],
      },
    },
  };

  beforeEach(() => {
    win = env.win;
    markup = new SubscriptionMarkup(win);
    state = new SubscriptionState(win);
    authFlow = new AuthorizationFlow(win, markup, state);
  });

  function addConfig(content) {
    const config = win.document.createElement('script');
    config.id = 'subscriptionsConfig';
    config.setAttribute('type', 'application/json');
    if (content) {
      config.textContent = isObject(content)
          ? JSON.stringify(content) : content;
    }
    win.document.body.appendChild(config);

  }

  it('throws when pay-wall config is not found on page', () => {
    expect(() => authFlow.getPaywallConfig_()).to.throw(
        /No Subscription config found/);
  });

  it('throws when pay-wall config is empty', () => {
    expect(() => authFlow.getPaywallConfig_()).to.throw; /* Native Error */
  });

  it('throws when pay-wall config is empty (2)', () => {
    addConfig('{}');
    expect(() => authFlow.getPaywallConfig_()).to.throw(
        /Subscription config is empty/);
  });

  it('throws when pay-wall config is invalid', () => {
    addConfig(
        `{
          "profiles": {
            "offer": {
              "services": [
                {
                  "id": "publisher.com",
                  "authorizationUrl": "http://foo.com",
                }
              ]
            }
          }
        }`);
    expect(() => authFlow.getPaywallConfig_()).to.throw(
        /Subscription config could not be parsed/);
  });

  it('throws when pay-wall config doesn\'t have the right profile', () => {
    addConfig(validConfig);
    return authFlow.start().should.be.rejectedWith(
        /Can't find the subscriber profile/);
  });

  it('throws when subscription service doesn\'t return JSON', () => {
    addConfig(validConfig);
    authFlow.accessType_ = 'offer';

    const fetchStub = sandbox.stub(authFlow.xhr_, 'fetch');
    fetchStub.returns(Promise.resolve({json: () => undefined}));
    return authFlow.start().should.be.rejected;
  });

  it('returns authorization response', () => {
    addConfig(validConfig);
    authFlow.accessType_ = 'offer';

    sandbox.stub(authFlow.xhr_, 'fetch')
        .returns(Promise.resolve({json: () => ({})}));
    return expect(authFlow.start().then(() => state.activeResponse))
        .to.eventually.not.be.null;
  });

  it('returns multiple authorization response', () => {
    authFlow.accessType_ = 'offer';

    const fetchStub = sandbox.stub(authFlow.xhr_, 'fetch');
    let index = 0;
    fetchStub.returns(Promise.resolve({json: () => ({'data': index++})}));
    return expect(authFlow.sendAuthRequests_(configWithMultipleSP)).to
        .eventually.satisfy(function(res) {
          return res.length == 3 && res[0].response['data'] == '0'
                && res[1].response['data'] == '1'
                && res[2].response['data'] == '2';

        });
  });

  describe('sorts authorization responses', () => {
    let fetchStub;
    let index;
    beforeEach(() => {
      authFlow.accessType_ = 'offer';
      fetchStub = sandbox.stub(authFlow.xhr_, 'fetch');
      fetchStub.returns(Promise.resolve({json: () => ({'data': index++})}));
      index = 0;
    });

    function getConfigWithWeights(first, second, third) {
      const config = map(configWithMultipleSP);
      const services = config['profiles'][authFlow.accessType_]['services'];
      services[0]['weight'] = first;
      services[1]['weight'] = second;
      services[2]['weight'] = third;
      return config;
    }

    it('based on weights (1/3)', () => {
      addConfig(getConfigWithWeights(0, 1, 2));
      return expect(authFlow.start()
          .then(() => state.activeResponse))
          .to.eventually.have.property('data', 2);
    });

    it('based on weights (2/3)', () => {
      addConfig(getConfigWithWeights(2, 1, 0));
      return expect(authFlow.start()
          .then(() => state.activeResponse))
          .to.eventually.have.property('data', 0);
    });

    it('based on weights (3/3)', () => {
      addConfig(getConfigWithWeights(0, 2, 1));
      return expect(authFlow.start()
          .then(() => state.activeResponse))
          .to.eventually.have.property('data', 1);
    });

    it('and uses callback for platform selection', () => {
      addConfig(getConfigWithWeights(0, 1, 2));
      return expect(authFlow.start((responses => responses[1].response))
          .then(() => state.activeResponse))
          .to.eventually.have.property('data', 1);
    });
  });

  describe('on slow connection', () => {
    let resolve;
    let clock;

    beforeEach(() => {
      clock = sandbox.useFakeTimers();
      win.setTimeout = self.setTimeout;
      authFlow.getPaywallConfig_ = () => new Promise(res => {
        resolve = res;
      });
      authFlow.accessType_ = 'offer';
      const fetchStub = sandbox.stub(authFlow.xhr_, 'fetch');
      fetchStub.returns(Promise.resolve({json: () => ({})}));
    });

    it('throws when the sub platform takes forever to respond', () => {
      const authPromise = authFlow.start();
      clock.tick(10000);
      return authPromise.should.be.rejectedWith(
          /Authorization could not complete on time/);
    });

    it('throws when the sub platform takes a little longer to respond', () => {
      const authPromise = authFlow.start();
      clock.tick(9999);
      resolve(JSON.parse(validConfig));
      return expect(authPromise).to.eventually.not.be.null;
    });
  });
});
