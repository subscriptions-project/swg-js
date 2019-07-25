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
import {Propensity} from './propensity';
import {PropensityType} from '../api/propensity-api';
import {Event,SubscriptionState} from '../api/logger-api';
import {Logger} from './logger';
import {PageConfig} from '../model/page-config';
import {PropensityServer} from './propensity-server';
import {ClientEventManager} from './client-event-manager';

describes.realWin('Propensity', {}, env => {
  let win;
  let config;
  let eventManager;
  let logger;
  let propensity;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig('pub1', true);
    eventManager = new ClientEventManager(Promise.resolve());
    logger = new Logger(Promise.resolve(eventManager));
    propensity = new Propensity(win, config, eventManager, logger);
  });

  describe('logger integration', () => {
    it('should send subscription state to logger', () => {
      const sentProducts = {'code': 1};

      let receivedState = null;
      let receivedProducts = null;

      sandbox.stub(Logger.prototype, 'sendSubscriptionState',
          (state, prods) => {
            receivedState = state;
            receivedProducts = prods;
          });
      propensity.sendSubscriptionState(SubscriptionState.UNKNOWN, sentProducts);

      expect(receivedState).to.equal(SubscriptionState.UNKNOWN);
      expect(receivedProducts).to.deep.equal(sentProducts);
    });

    it('should send events to logger', () => {
      const eventSent = {
        name: Event.IMPRESSION_PAYWALL,
      };
      let eventReceived = null;

      sandbox.stub(Logger.prototype, 'sendEvent',
          event => eventReceived = event);
      propensity.sendEvent(eventSent);
      expect(eventReceived).to.deep.equal(eventSent);
    });
  });

  describe('getPropensity', () => {
    it('should request valid propensity type', () => {
      const err = /Invalid propensity type requested/;
      //don't make actual request to the server
      sandbox.stub(PropensityServer.prototype, 'getPropensity', () => {});

      expect(() => {
        propensity.getPropensity(PropensityType.GENERAL);
      }).to.not.throw(err);
      expect(() => {
        propensity.getPropensity('paywall-specific');
      }).to.throw(err);
    });

    it('should return propensity score from server', () => {
      const scoreDetails = [{
        score: 42,
        bucketed: false,
      }];
      sandbox.stub(PropensityServer.prototype, 'getPropensity',
          () => {
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({
                  'header': {'ok': true},
                  'body': {'scores': scoreDetails},
                });
              }, 10);
            });
          });
      return propensity.getPropensity().then(propensityScore => {
        expect(propensityScore).to.not.be.null;
        expect(propensityScore.header).to.not.be.null;
        expect(propensityScore.header.ok).to.be.true;
        expect(propensityScore.body).to.not.be.null;
        expect(propensityScore.body.scores).to.not.be.null;
        expect(propensityScore.body.scores[0].score).to.equal(42);
      });
    });
  });
});
