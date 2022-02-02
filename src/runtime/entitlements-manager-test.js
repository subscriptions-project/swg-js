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

import {ActivityPorts} from '../components/activities';
import {
  AnalyticsContext,
  AnalyticsEvent,
  EntitlementJwt,
  EntitlementResult,
  EntitlementSource,
  EntitlementsRequest,
  EventOriginator,
  EventParams,
} from '../proto/api_messages';
import {AnalyticsService} from './analytics-service';
import {Callbacks} from './callbacks';
import {ClientEventManager} from './client-event-manager';
import {Constants} from '../utils/constants';
import {DepsDef} from './deps';
import {DialogManager} from '../components/dialog-manager';
import {
  Entitlement,
  Entitlements,
  GOOGLE_METERING_SOURCE,
  PRIVILEGED_SOURCE,
} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {GlobalDoc} from '../model/doc';
import {MeterClientTypes} from '../api/metering';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';
import {Toast} from '../ui/toast';
import {XhrFetcher} from './fetcher';
import {analyticsEventToEntitlementResult} from './event-type-mapping';
import {base64UrlEncodeFromBytes, utf8EncodeSync} from '../utils/bytes';
import {defaultConfig} from '../api/subscriptions';
import {serializeProtoMessageForUrl} from '../utils/url';

const ENTITLEMENTS_URL =
  '$frontend$/swg/_/api/v1/publication/pub1/entitlements';

const MOCK_TIME_ARRAY = [1600389016, 959000000];

describes.realWin('EntitlementsManager', {}, (env) => {
  let win;
  let nowStub;
  let pageConfig;
  let manager;
  let fetcher;
  let xhrMock;
  let jwtHelperMock;
  let callbacks;
  let storageMock;
  let config;
  let activitiesMock;
  let analyticsMock;
  let deps;
  let encryptedDocumentKey;
  let dialogManager;
  let dialogManagerMock;
  let eventManager;
  let eventManagerMock;
  let defaultGoogleMeteringEncodedParams;
  let noClientTypeParams;

  beforeEach(() => {
    // Work around `location.search` being non-configurable,
    // which means Sinon can't stub it normally.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_redefine_property
    win = Object.assign({}, env.win, {
      location: {
        search: '?gaa_at=at&gaa_n=token&gaa_sig=sig&gaa_ts=60389016',
      },
    });
    sandbox.stub(win, 'matchMedia').returns({
      'matches': true,
      'addListener': (callback) => callback,
    });
    win['addEventListener'] = () => {};
    pageConfig = new PageConfig('pub1:label1');
    fetcher = new XhrFetcher(win);
    eventManager = new ClientEventManager(Promise.resolve());
    eventManagerMock = sandbox.mock(eventManager);
    xhrMock = sandbox.mock(fetcher.xhr_);
    config = defaultConfig();
    deps = new DepsDef();
    sandbox.stub(deps, 'win').returns(win);
    const globalDoc = new GlobalDoc(win);
    sandbox.stub(deps, 'doc').returns(globalDoc);
    callbacks = new Callbacks();
    sandbox.stub(deps, 'callbacks').returns(callbacks);
    const storage = new Storage(win);
    storageMock = sandbox.mock(storage);
    dialogManager = new DialogManager(new GlobalDoc(win));
    dialogManagerMock = sandbox.mock(dialogManager);
    sandbox.stub(deps, 'storage').returns(storage);
    sandbox.stub(deps, 'pageConfig').returns(pageConfig);
    sandbox.stub(deps, 'config').returns(config);
    sandbox.stub(deps, 'eventManager').returns(eventManager);
    sandbox.stub(deps, 'dialogManager').returns(dialogManager);
    const activityPorts = new ActivityPorts(deps);
    activitiesMock = sandbox.mock(activityPorts);
    sandbox.stub(deps, 'activities').returns(activityPorts);
    const analyticsService = new AnalyticsService(deps);
    analyticsMock = sandbox.mock(analyticsService);
    sandbox
      .stub(analyticsService, 'getContext')
      .returns(new AnalyticsContext());
    sandbox.stub(deps, 'analytics').returns(analyticsService);

    manager = new EntitlementsManager(win, pageConfig, fetcher, deps);
    jwtHelperMock = sandbox.mock(manager.jwtHelper_);
    encryptedDocumentKey =
      '{"accessRequirements": ' +
      '["norcal.com:premium"], "key":"aBcDef781-2-4/sjfdi"}';

    sandbox.stub(self.console, 'warn');
    nowStub = sandbox.stub(Date, 'now').returns(1600389016959);
    defaultGoogleMeteringEncodedParams = base64UrlEncodeFromBytes(
      utf8EncodeSync(
        '{"metering":{"clientTypes":[2],"owner":"pub1","resource":{"hashedCanonicalUrl":"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"}}}'
      )
    );
    noClientTypeParams = base64UrlEncodeFromBytes(
      utf8EncodeSync(
        '{"metering":{"resource":{"hashedCanonicalUrl":"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"}}}'
      )
    );
  });

  afterEach(async () => {
    // Wait for POST requests to complete.
    if (manager.entitlementsPostPromise) {
      await manager.entitlementsPostPromise;
    }

    storageMock.verify();
    xhrMock.verify();
    jwtHelperMock.verify();
    activitiesMock.verify();
    analyticsMock.verify();
    dialogManagerMock.verify();
    eventManagerMock.verify();
    self.console.warn.restore();
  });

  function expectNoResponse() {
    xhrMock
      .expects('fetch')
      .returns(
        Promise.resolve({
          text: () => Promise.resolve('{}'),
        })
      )
      .once();
  }

  function entitlementsResponse(entitlements, options, isReadyToPay) {
    function enc(obj) {
      return base64UrlEncodeFromBytes(utf8EncodeSync(JSON.stringify(obj)));
    }
    options = Object.assign(
      {
        exp: Math.floor(Date.now() / 1000) + 10, // 10 seconds in the future.
      },
      options
    );
    const header = {};
    const payload = {
      'iss': 'google.com',
      'exp': options.exp,
      'entitlements': entitlements,
    };
    return {
      'signedEntitlements': enc(header) + '.' + enc(payload) + '.SIG',
      'isReadyToPay': isReadyToPay,
    };
  }

  function expectGoogleResponse(options, isReadyToPay, decryptedDocumentKey) {
    const resp = entitlementsResponse(
      {
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      },
      options,
      isReadyToPay,
      decryptedDocumentKey
    );
    xhrMock
      .expects('fetch')
      .returns(
        Promise.resolve({
          text: () => Promise.resolve(JSON.stringify(resp)),
        })
      )
      .once();
    expectEntitlementPingback({
      entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
      entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
      isUserRegistered: true,
    });
    return resp;
  }

  function expectNonGoogleResponse(
    options,
    isReadyToPay,
    decryptedDocumentKey
  ) {
    const resp = entitlementsResponse(
      {
        source: 'pub1',
        products: ['pub1:label1'],
        subscriptionToken: 's2',
      },
      options,
      isReadyToPay,
      decryptedDocumentKey
    );
    xhrMock
      .expects('fetch')
      .returns(
        Promise.resolve({
          text: () => Promise.resolve(JSON.stringify(resp)),
        })
      )
      .once();
    expectEntitlementPingback({
      entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
      entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
      isUserRegistered: true,
    });
    return resp;
  }

  function getEventParams(isUserRegistered) {
    const params = new EventParams();
    params.setIsUserRegistered(isUserRegistered);
    return params;
  }

  function expectLog(event, isUserGenerated, eventParams = null) {
    if (eventParams) {
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(event, isUserGenerated, eventParams)
        .returns(null)
        .once();
    } else {
      eventManagerMock
        .expects('logSwgEvent')
        .withExactArgs(event, isUserGenerated)
        .returns(null)
        .once();
    }
  }

  function expectPost(url, message) {
    xhrMock
      .expects('fetch')
      .withExactArgs(url, {
        body: 'f.req=' + serializeProtoMessageForUrl(message),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        method: 'POST',
      })
      .returns(Promise.resolve());
  }

  function expectEntitlementPingback({
    entitlementSource = '',
    entitlementResult = 0,
    jwtString = null,
    jwtSource = null,
    isUserRegistered = null,
    pingbackUrl = '',
    devModeParams = '',
    gaaToken = 'token',
    mockTimeArray = MOCK_TIME_ARRAY,
    userToken = null,
  } = {}) {
    expectGetSwgUserTokenToBeCalled(userToken);
    const encodedParams = base64UrlEncodeFromBytes(
      utf8EncodeSync(
        '{"metering":{"resource":{"hashedCanonicalUrl":"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"}}}'
      )
    );
    const url =
      pingbackUrl ||
      ENTITLEMENTS_URL +
        '?' +
        (userToken ? `sut=${userToken}&` : '') +
        (devModeParams ? `devEnt=${devModeParams}&` : '') +
        `encodedParams=${encodedParams}`;
    expectPost(
      url,
      new EntitlementsRequest(
        [
          new EntitlementJwt([jwtString, jwtSource], false).toArray(false),
          mockTimeArray,
          entitlementSource,
          entitlementResult,
          gaaToken,
          isUserRegistered,
        ],
        false
      )
    );
  }

  // Clear locally stored SwgUserToken.
  function expectGetSwgUserTokenToBeCalled(userToken = null) {
    storageMock
      .expects('get')
      .withExactArgs(Constants.USER_TOKEN, true)
      .returns(Promise.resolve(userToken));
  }

  describe('fetching', () => {
    beforeEach(() => {
      // Expect empty cache.
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(null))
        .atLeast(0);
      storageMock
        .expects('get')
        .withExactArgs('toast')
        .returns(Promise.resolve(null))
        .atLeast(0);
      storageMock
        .expects('get')
        .withExactArgs('isreadytopay')
        .returns(Promise.resolve(null))
        .atLeast(0);
    });

    it('should fetch empty response', async () => {
      xhrMock
        .expects('fetch')
        .withExactArgs(
          `$frontend$/swg/_/api/v1/publication/pub1/entitlements`,
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements();
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('');
      expect(ents.entitlements).to.deep.equal([]);
      expect(ents.product_).to.equal('pub1:label1');
      expect(ents.enablesThis()).to.be.false;
    });

    it('adds dev mode params to request when present on the URL', async () => {
      const scenario = 'TEST_SCENARIO';
      win.location.hash = `#swg.debug=1&swg.deventitlement=${scenario}`;
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?devEnt=' +
            encodeURIComponent(scenario) +
            '&crypt=' +
            encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );
      expectGetSwgUserTokenToBeCalled();

      await manager.getEntitlements({
        encryption: {encryptedDocumentKey},
      });
    });

    it('should accept encrypted document key', async () => {
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
            encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements({
        encryption: {encryptedDocumentKey},
      });
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('');
      expect(ents.entitlements).to.deep.equal([]);
      expect(ents.product_).to.equal('pub1:label1');
      expect(ents.enablesThis()).to.be.false;
    });

    it('should accept swgUserToken from local storage', async () => {
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
            encodeURIComponent(encryptedDocumentKey) +
            '&sut=' +
            encodeURIComponent('abc'),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);

      // Check SwgUserToken from local storage.
      storageMock
        .expects('get')
        .withExactArgs(Constants.USER_TOKEN, true)
        .returns(Promise.resolve('abc')).once;

      // getEntitlements params do not include swgUserToken
      const ents = await manager.getEntitlements({
        encryption: {
          encryptedDocumentKey:
            '{"accessRequirements": ' +
            '["norcal.com:premium"], "key":"aBcDef781-2-4/sjfdi"}',
        },
      });
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('');
      expect(ents.entitlements).to.deep.equal([]);
      expect(ents.product_).to.equal('pub1:label1');
      expect(ents.enablesThis()).to.be.false;
    });

    it('should handle present decrypted document key', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
          },
        });
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns({
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        });
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
            encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  signedEntitlements: 'SIGNED_DATA',
                  decryptedDocumentKey: 'ddk1',
                })
              ),
          })
        );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements(encryptedDocumentKey);
      expect(ents.decryptedDocumentKey).to.equal('ddk1');
    });

    it('should handle and store swgUserToken if it exists in the response with JWT entitlements', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
          },
        });
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns({
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        });
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
            encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  signedEntitlements: 'SIGNED_DATA',
                  decryptedDocumentKey: 'ddk1',
                  swgUserToken: 'abc',
                })
              ),
          })
        );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, 'abc', true);

      storageMock.expects('set').withExactArgs('ents', 'SIGNED_DATA');

      const ents = await manager.getEntitlements(encryptedDocumentKey);
      expect(ents.decryptedDocumentKey).to.equal('ddk1');
    });

    it('should handle and store swgUserToken if it exists in the response with plain entitlements', async () => {
      xhrMock.expects('fetch').returns(
        Promise.resolve({
          text: () =>
            Promise.resolve(
              JSON.stringify({
                entitlements: {
                  products: ['pub1:label1'],
                  subscriptionToken: 's1',
                },
                swgUserToken: 'abc',
              })
            ),
        })
      );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, 'abc', true);

      const entitlements = await manager.getEntitlements();
      expect(entitlements.entitlements[0].subscriptionToken).to.equal('s1');
    });

    it('should handle and store swgUserToken if no entitlements', async () => {
      xhrMock.expects('fetch').returns(
        Promise.resolve({
          text: () =>
            Promise.resolve(
              JSON.stringify({
                swgUserToken: 'abc',
              })
            ),
        })
      );

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);

      expectGetSwgUserTokenToBeCalled();

      storageMock
        .expects('set')
        .withExactArgs(Constants.USER_TOKEN, 'abc', true);

      await manager.getEntitlements();
    });

    it('should handle missing decrypted document key', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
          },
        });
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns({
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        });
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=' +
            encodeURIComponent(encryptedDocumentKey),
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve('{"signedEntitlements": "SIGNED_DATA"}'),
          })
        );
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements(encryptedDocumentKey);
      expect(ents.decryptedDocumentKey).to.be.null;
    });

    it('should fetch non-empty response', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
          },
        });
      const testSubscriptionTokenContents = {
        metering: {
          ownerId: 'scenic-2017.appspot.com',
          action: 'READ',
          clientUserAttribute: 'standard_registered_user',
        },
      };
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns(testSubscriptionTokenContents);
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements',
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve('{"signedEntitlements": "SIGNED_DATA"}'),
          })
        );
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements();
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('SIGNED_DATA');
      expect(ents.entitlements).to.deep.equal([
        {
          source: '',
          products: ['pub1:label1'],
          subscriptionToken: 'token1',
          subscriptionTokenContents: testSubscriptionTokenContents,
        },
      ]);

      expect(ents.enablesThis()).to.be.true;
    });

    it('logs a special event when unlocking for crawlers', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
            source: PRIVILEGED_SOURCE,
          },
        });
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns({
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        });
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements',
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve('{"signedEntitlements": "SIGNED_DATA"}'),
          })
        );
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_FOR_CRAWLER,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();

      await manager.getEntitlements();
    });

    it('should only fetch once', async () => {
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        )
        .once();
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      await manager.getEntitlements();

      await manager.getEntitlements();
    });

    it('should re-fetch after reset', async () => {
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        )
        .twice();

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      await manager.getEntitlements();

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      manager.reset();
      await manager.getEntitlements();
    });

    it('should reset with positive expectation', () => {
      manager.reset();
      expect(manager.positiveRetries_).to.equal(0);
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      manager.reset();
      expect(manager.positiveRetries_).to.equal(3);
    });

    it('should fetch with positive expectation with one attempt', async () => {
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  entitlements: {
                    products: ['pub1:label1'],
                    subscriptionToken: 's1',
                  },
                })
              ),
          })
        )
        .once();

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(
        AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
        false,
        getEventParams(true)
      );
      expectGetSwgUserTokenToBeCalled();
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);

      const entitlements = await manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      expect(entitlements.entitlements[0].subscriptionToken).to.equal('s1');
    });

    it('should fetch with positive expectation with two attempts', async () => {
      let totalTime = 0;
      sandbox.stub(win, 'setTimeout').callsFake((callback, timeout) => {
        totalTime += timeout;
        callback();
      });
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  entitlements: {
                    products: ['pub1:label2'],
                    subscriptionToken: 's2',
                  },
                })
              ),
          })
        )
        .once();
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  entitlements: {
                    products: ['pub1:label1'],
                    subscriptionToken: 's1',
                  },
                })
              ),
          })
        )
        .once();
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
        entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
        isUserRegistered: true,
      });
      expectGetSwgUserTokenToBeCalled();
      manager.reset(true);
      expect(manager.positiveRetries_).to.equal(3);
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      expect(entitlements.entitlements[0].subscriptionToken).to.equal('s1');
      expect(totalTime).to.be.greaterThan(499);
    });

    it('should fetch with positive expectation with max attempts', async () => {
      let totalTime = 0;
      sandbox.stub(win, 'setTimeout').callsFake((callback, timeout) => {
        totalTime += timeout;
        callback();
      });
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  entitlements: {
                    products: ['pub1:label2'],
                    subscriptionToken: 's2',
                  },
                })
              ),
          })
        )
        .thrice();
      expectGetSwgUserTokenToBeCalled();
      manager.reset(true);
      expectGetSwgUserTokenToBeCalled();
      expect(manager.positiveRetries_).to.equal(3);
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0);
      expect(entitlements.entitlements).to.have.length(1);
      expect(entitlements.entitlements[0].subscriptionToken).to.equal('s2');
      expect(totalTime).to.be.greaterThan(999);
    });

    it('should re-fetch after clear', async () => {
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        )
        .twice();
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();
      await manager.getEntitlements();

      manager.clear();
      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_NO_ENTITLEMENTS, false);
      expectGetSwgUserTokenToBeCalled();

      await manager.getEntitlements();
    });

    it('should clear all state and cache', () => {
      manager.reset(true);
      manager.blockNextNotification();
      manager.responsePromise_ = Promise.reject();
      expect(manager.positiveRetries_).to.equal(3);
      expect(manager.blockNextNotification_).to.be.true;

      storageMock.expects('remove').withExactArgs('ents').once();
      storageMock.expects('remove').withExactArgs('toast').once();
      storageMock.expects('remove').withExactArgs('isreadytopay').once();

      manager.clear();
      expect(manager.positiveRetries_).to.equal(0);
      expect(manager.blockNextNotification_).to.be.false;
      expect(manager.responsePromise_).to.be.null;
    });

    it('should fetch metering entitlements', async () => {
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
            source: 'google:metering',
          },
        });
      const testSubscriptionTokenContents = {
        metering: {
          ownerId: 'scenic-2017.appspot.com',
          action: 'READ',
          clientUserAttribute: 'standard_registered_user',
        },
      };
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns(testSubscriptionTokenContents);
      const encodedParams = base64UrlEncodeFromBytes(
        utf8EncodeSync(
          '{"metering":{"clientTypes":[1],"owner":"pub1","resource":{"hashedCanonicalUrl":"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"},"state":{"id":"u1","attributes":[{"name":"standard_att1","timestamp":1234567},{"name":"custom_att2","timestamp":1234567}]},"token":"token"}}'
        )
      );
      xhrMock
        .expects('fetch')
        .withExactArgs(
          `$frontend$/swg/_/api/v1/publication/pub1/entitlements?encodedParams=${encodedParams}`,
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  signedEntitlements: 'SIGNED_DATA',
                })
              ),
          })
        );

      // Toast shouldn't open.
      storageMock.expects('get').withExactArgs('toast').never();
      expectGetSwgUserTokenToBeCalled();

      expectLog(AnalyticsEvent.ACTION_GET_ENTITLEMENTS, false);
      expectLog(AnalyticsEvent.EVENT_HAS_METERING_ENTITLEMENTS, false);

      const ents = await manager.getEntitlements({
        metering: {
          state: {
            id: 'u1',
            standardAttributes: {'att1': {timestamp: 1234567}},
            customAttributes: {'att2': {timestamp: 1234567}},
          },
        },
      });
      expect(ents.service).to.equal('subscribe.google.com');
      expect(ents.raw).to.equal('SIGNED_DATA');
      expect(ents.entitlements).to.deep.equal([
        {
          source: 'google:metering',
          products: ['pub1:label1'],
          subscriptionToken: 'token1',
          subscriptionTokenContents: testSubscriptionTokenContents,
        },
      ]);
      expect(ents.enablesThis()).to.be.true;
    });

    it('should warn about invalid attribute timestamps', async () => {
      const invalidTimestamps = [
        undefined,
        null,
        0,
        '0',
        Date.now(), // In milliseconds, instead of seconds
        'Friday, 7 May 2021 18:16:51',
      ];

      for (const invalidTimestamp of invalidTimestamps) {
        self.console.warn.reset();
        manager.clear();

        xhrMock.expects('fetch').resolves({text: () => Promise.resolve('{}')});
        expectGetSwgUserTokenToBeCalled();

        await manager.getEntitlements({
          metering: {
            state: {
              id: 'u1',
              standardAttributes: {'att1': {timestamp: invalidTimestamp}},
            },
          },
        });

        expect(self.console.warn).to.have.been.calledWithExactly(
          `SwG Entitlements: Please specify a Unix timestamp, in seconds, for the "att1" standard attribute. The timestamp you passed (${invalidTimestamp}) looks invalid.`
        );
      }
    });

    it('should warn about missing meter state ID', async () => {
      const invalidMeterStateIds = [undefined, null, false, {}, ''];

      for (const invalidMeterStateId of invalidMeterStateIds) {
        self.console.warn.reset();
        manager.clear();

        xhrMock.expects('fetch').resolves({text: () => Promise.resolve('{}')});
        expectGetSwgUserTokenToBeCalled();

        await manager.getEntitlements({
          metering: {
            state: {
              id: invalidMeterStateId,
            },
          },
        });

        expect(self.console.warn).to.have.been.calledWithExactly(
          `SwG Entitlements: Please specify a metering state ID string, ideally a hash to avoid PII.`
        );
      }
    });

    it('should not open metering dialog when metering entitlements are consumed and showToast is not provided', () => {
      sandbox.stub(fetcher.xhr_, 'fetch').resolves();
      dialogManagerMock.expects('openDialog').never();
      expectGetSwgUserTokenToBeCalled();

      const ents = new Entitlements(
        'service1',
        'RaW',
        [
          new Entitlement(
            GOOGLE_METERING_SOURCE,
            ['product1', 'product2'],
            'token1',
            {
              metering: {
                ownerId: 'scenic-2017.appspot.com',
                action: 'READ',
                clientUserAttribute: 'standard_registered_user',
              },
            }
          ),
        ],
        'product1'
      );

      manager.consume_(ents);
    });

    it('should not open metering dialog when metering entitlements are consumed and signJwt throws', () => {
      sandbox.stub(fetcher.xhr_, 'fetch').resolves();
      dialogManagerMock.expects('openDialog').never();
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .throws(new Error('parsing failed'));

      const ents = manager.createEntitlements_('RaW', [
        new Entitlement(
          GOOGLE_METERING_SOURCE,
          ['product1', 'product2'],
          'token1'
        ).json(),
      ]);

      manager.consume_(ents);
    });

    it('should open metering dialog when metering entitlements are consumed and showToast is true', async () => {
      expectGetSwgUserTokenToBeCalled();
      dialogManagerMock
        .expects('openDialog')
        .once()
        .returns(
          Promise.resolve({
            'openView': () => {
              return Promise.resolve({});
            },
          })
        );
      const element = {
        'style': {
          'setProperty': () => {},
        },
      };
      const dialog = {
        'getElement': () => {
          return element;
        },
        'getLoadingView': () => {
          return {
            'getElement': () => {
              return element;
            },
          };
        },
      };
      dialogManagerMock.expects('getDialog').atLeast(1).returns(dialog);

      const ents = new Entitlements(
        'service1',
        'RaW',
        [
          new Entitlement(
            GOOGLE_METERING_SOURCE,
            ['product1', 'product2'],
            'token1',
            {
              metering: {
                ownerId: 'scenic-2017.appspot.com',
                action: 'READ',
                clientUserAttribute: 'standard_registered_user',
                showToast: true,
              },
            }
          ),
        ],
        'product1'
      );

      await manager.consume_(ents);
    });

    it('should not open metering dialog when metering entitlements are consumed and showToast is false', () => {
      sandbox.stub(fetcher.xhr_, 'fetch').resolves();
      expectGetSwgUserTokenToBeCalled();
      const ents = new Entitlements(
        'service1',
        'RaW',
        [
          new Entitlement(
            GOOGLE_METERING_SOURCE,
            ['product1', 'product2'],
            'token1',
            {
              metering: {
                ownerId: 'scenic-2017.appspot.com',
                action: 'READ',
                clientUserAttribute: 'standard_registered_user',
                showToast: false,
              },
            }
          ),
        ],
        'product1'
      );

      manager.consume_(ents);
    });

    it('should not open metering dialog when non-metering entitlements are consumed', () => {
      dialogManagerMock.expects('openView').never();

      const ents = new Entitlements(
        'service1',
        'RaW',
        [new Entitlement('google', ['product1', 'product2'])],
        'product1'
      );

      eventManagerMock.expects('logSwgEvent').never();
      manager.consume_(ents);
    });

    it('should send pingback with metering entitlements', async () => {
      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        }
      );

      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SHOWCASE_METERING_SERVICE,
        entitlementResult: EntitlementResult.UNLOCKED_METER,
        jwtString: 'token1',
        jwtSource: GOOGLE_METERING_SOURCE,
        pingbackUrl:
          ENTITLEMENTS_URL + `?sut=abc&encodedParams=${noClientTypeParams}`,
        userToken: 'abc',
      });
      expectLog(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);

      await manager.consumeMeter_(ent);
    });

    it('when MeterClientType is METERED_BY_GOOGLE, pingback should have EntitlementSource.SUBSCRIBE_WITH_GOOGLE_METERING_SERVICE', async () => {
      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
            clientType: MeterClientTypes.METERED_BY_GOOGLE.valueOf(),
          },
        }
      );

      expectEntitlementPingback({
        entitlementSource:
          EntitlementSource.SUBSCRIBE_WITH_GOOGLE_METERING_SERVICE,
        entitlementResult: EntitlementResult.UNLOCKED_METER,
        jwtString: 'token1',
        jwtSource: GOOGLE_METERING_SOURCE,
        pingbackUrl:
          ENTITLEMENTS_URL + '?sut=abc&encodedParams=3ncod3dM3t3ringParams',
        gaaToken: '',
        userToken: 'abc',
      });
      manager.encodedParams_ = '3ncod3dM3t3ringParams';
      expectLog(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);
      await manager.consumeMeter_(ent);
    });

    it('should send pingback with metering entitlements and meter params', async () => {
      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
            clientType: MeterClientTypes.LICENSED_BY_GOOGLE.valueOf(),
          },
        }
      );

      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SHOWCASE_METERING_SERVICE,
        entitlementResult: EntitlementResult.UNLOCKED_METER,
        jwtString: 'token1',
        jwtSource: GOOGLE_METERING_SOURCE,
        pingbackUrl: ENTITLEMENTS_URL + '?encodedParams=3ncod3dM3t3ringParams',
      });
      manager.encodedParams_ = '3ncod3dM3t3ringParams';
      expectLog(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);
      await manager.consumeMeter_(ent);
    });

    it('sends pingback with dev mode params from URL', async () => {
      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        }
      );
      const scenario = 'TEST_SCENARIO';
      win.location.hash = `#swg.debug=1&swg.deventitlement=${scenario}`;
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SHOWCASE_METERING_SERVICE,
        entitlementResult: EntitlementResult.UNLOCKED_METER,
        jwtString: 'token1',
        jwtSource: GOOGLE_METERING_SOURCE,
        pingbackUrl:
          ENTITLEMENTS_URL +
          `?devEnt=${scenario}&encodedParams=${noClientTypeParams}`,
        devModeParams: scenario,
      });
      expectLog(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);

      await manager.consumeMeter_(ent);
    });

    it('should not send pingback with non-metering entitlements', async () => {
      xhrMock.expects('fetch').never();

      const ent = new Entitlement(
        'source1',
        ['product1', 'product2'],
        'token1'
      );
      eventManagerMock.expects('logSwgEvent').never();
      await manager.consumeMeter_(ent);
    });

    it('should not send pingback with invalid GAA params for showcase without JWT', async () => {
      // Stub out Date.now() to some time past the URL timestamp expiration.
      nowStub.returns(3600389016959);
      xhrMock.expects('fetch').never();

      const ent = new Entitlement(GOOGLE_METERING_SOURCE, [
        'product1',
        'product2',
      ]);
      eventManagerMock.expects('logSwgEvent').never();
      await manager.consumeMeter_(ent);
    });

    it('should not send pingback with invalid GAA params for showcase with JWT', async () => {
      // Stub out Date.now() to some time past the URL timestamp expiration.
      nowStub.returns(3600389016959);
      xhrMock.expects('fetch').never();

      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            ownerId: 'scenic-2017.appspot.com',
            action: 'READ',
            clientUserAttribute: 'standard_registered_user',
          },
        }
      );
      const jwtContents = {
        metering: {
          clientType: MeterClientTypes.LICENSED_BY_GOOGLE.valueOf(),
        },
      };
      eventManagerMock.expects('logSwgEvent').never();
      await manager.consumeMeter_(ent, jwtContents);
    });

    it('should pingback for metering without GAA params for METERED_BY_GOOGLE ', async () => {
      // Reset the win.location to clear the default from beforeEach
      win.location = {'search': ''};

      const ent = new Entitlement(
        GOOGLE_METERING_SOURCE,
        ['product1', 'product2'],
        'token1',
        {
          metering: {
            clientType: MeterClientTypes.METERED_BY_GOOGLE.valueOf(),
          },
        }
      );
      expectEntitlementPingback({
        entitlementSource:
          EntitlementSource.SUBSCRIBE_WITH_GOOGLE_METERING_SERVICE,
        entitlementResult: EntitlementResult.UNLOCKED_METER,
        jwtString: 'token1',
        jwtSource: GOOGLE_METERING_SOURCE,
        pingbackUrl:
          ENTITLEMENTS_URL + '?sut=abc&encodedParams=3ncod3dM3t3ringParams',
        gaaToken: '',
        userToken: 'abc',
      });
      expectLog(AnalyticsEvent.EVENT_UNLOCKED_BY_METER, false);
      manager.encodedParams_ = '3ncod3dM3t3ringParams';
      await manager.consumeMeter_(ent);
    });

    it('should log error messages from entitlements server', async () => {
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements',
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () =>
              Promise.resolve(
                JSON.stringify({
                  errorMessages: ['Something went wrong'],
                })
              ),
          })
        );
      expectGetSwgUserTokenToBeCalled();
      await manager.getEntitlements();
      expect(self.console.warn).to.have.been.calledWithExactly(
        'SwG Entitlements: Something went wrong'
      );
    });

    it('should warn users about deprecated param', async () => {
      xhrMock
        .expects('fetch')
        .withExactArgs(
          '$frontend$/swg/_/api/v1/publication/pub1/entitlements?crypt=deprecated',
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );
      expectGetSwgUserTokenToBeCalled();
      await manager.getEntitlements('deprecated');
      expect(self.console.warn).to.have.been.calledWithExactly(
        '[swg.js:getEntitlements]: If present, the first param of getEntitlements() should be an object of type GetEntitlementsParamsExternalDef.'
      );
    });

    it('should use the article endpoint and correct parameters if configured', async () => {
      manager = new EntitlementsManager(
        win,
        pageConfig,
        fetcher,
        deps,
        /* useArticleEndpoint */ true
      );
      jwtHelperMock = sandbox.mock(manager.jwtHelper_);
      jwtHelperMock
        .expects('decode')
        .withExactArgs('SIGNED_DATA')
        .returns({
          entitlements: {
            products: ['pub1:label1'],
            subscriptionToken: 'token1',
            source: 'google:metering',
          },
        });
      const testSubscriptionTokenContents = {
        metering: {
          ownerId: 'scenic-2017.appspot.com',
          action: 'READ',
          clientUserAttribute: 'standard_registered_user',
        },
      };
      jwtHelperMock
        .expects('decode')
        .withExactArgs('token1')
        .returns(testSubscriptionTokenContents);
      const article = {
        entitlements: {
          signedEntitlements: 'SIGNED_DATA',
        },
        clientConfig: {
          id: 'foo',
        },
      };
      const encodedParams = base64UrlEncodeFromBytes(
        utf8EncodeSync(
          '{"metering":{"clientTypes":[1],"owner":"pub1","resource":{"hashedCanonicalUrl":"cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e"},"state":{"id":"u1","attributes":[]},"token":"token"}}'
        )
      );
      xhrMock
        .expects('fetch')
        .withExactArgs(
          `$frontend$/swg/_/api/v1/publication/pub1/article?encodedEntitlementsParams=${encodedParams}`,
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve(JSON.stringify(article)),
          })
        );
      expectGetSwgUserTokenToBeCalled();

      const ents = await manager.getEntitlements({
        metering: {
          state: {
            id: 'u1',
          },
        },
      });

      expect(ents.entitlements).to.deep.equal([
        {
          source: 'google:metering',
          products: ['pub1:label1'],
          subscriptionToken: 'token1',
          subscriptionTokenContents: testSubscriptionTokenContents,
        },
      ]);
      expect(ents.raw).to.equal('SIGNED_DATA');
      expect(await manager.getArticle()).to.deep.equal(
        article,
        'getArticle should return the article endpoint response'
      );
    });

    it('should only include METERED_BY_GOOGLE client type if explicitly enabled', async () => {
      expectGetSwgUserTokenToBeCalled();
      xhrMock
        .expects('fetch')
        .withExactArgs(
          `$frontend$/swg/_/api/v1/publication/pub1/entitlements?encodedParams=${defaultGoogleMeteringEncodedParams}`,
          {
            method: 'GET',
            headers: {'Accept': 'text/plain, application/json'},
            credentials: 'include',
          }
        )
        .returns(
          Promise.resolve({
            text: () => Promise.resolve('{}'),
          })
        );
      manager.enableMeteredByGoogle();

      await manager.getEntitlements();
    });
  });

  describe('event listening', () => {
    const GOOGLE_SOURCE = EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT;

    function expectNoPingback(
      event,
      originator,
      params = getEventParams(null)
    ) {
      xhrMock.expects('fetch').never();
      eventManager.logEvent({
        eventType: event,
        eventOriginator: originator,
        additionalParameters: params,
      });
      return eventManager.lastAction_;
    }

    function expectPingback(
      event,
      originator,
      expectedSource,
      params = getEventParams(null)
    ) {
      const result = analyticsEventToEntitlementResult(event);
      expectEntitlementPingback({
        entitlementSource: expectedSource,
        entitlementResult: result,
        isUserRegistered: params.getIsUserRegistered(),
        pingbackUrl: ENTITLEMENTS_URL + `?encodedParams=${noClientTypeParams}`,
      });
      eventManager.logEvent({
        eventType: event,
        eventOriginator: originator,
        additionalParameters: params,
      });
      return eventManager.lastAction_;
    }

    const PINGBACK_EVENTS = {
      [AnalyticsEvent.IMPRESSION_REGWALL]: 1,
      [AnalyticsEvent.EVENT_UNLOCKED_BY_METER]: 1,
      [AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION]: 1,
      [AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE]: 1,
      [AnalyticsEvent.IMPRESSION_PAYWALL]: 1,
      [AnalyticsEvent.EVENT_INELIGIBLE_PAYWALL]: 1,
      [AnalyticsEvent.UNKNOWN]: 1,
    };

    describe('SWG_CLIENT', () => {
      it('should pingback IMPRESSION_REGWALL', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_REGWALL,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE
        ));

      it('should NOT pingback EVENT_UNLOCKED_BY_METER', () =>
        expectNoPingback(
          AnalyticsEvent.EVENT_UNLOCKED_BY_METER,
          EventOriginator.SWG_CLIENT
        ));

      it('should pingback EVENT_UNLOCKED_BY_SUBSCRIPTION', () =>
        expectPingback(
          AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE,
          getEventParams(true)
        ));

      it('should pingback EVENT_UNLOCKED_FREE_PAGE', () =>
        expectPingback(
          AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE
        ));

      it('should pingback IMPRESSION_PAYWALL', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE
        ));

      it('should pingback EVENT_INELIGIBLE_PAYWALL', () =>
        expectPingback(
          AnalyticsEvent.EVENT_INELIGIBLE_PAYWALL,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE
        ));

      it('should pingback with isUserRegistered == true on valid event', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE,
          getEventParams(true)
        ));

      it('should pingback with isUserRegistered == false on valid event', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SWG_CLIENT,
          GOOGLE_SOURCE,
          getEventParams(false)
        ));

      it('should NOT pingback on invalid GAA params', async () => {
        // Stub out Date.now() to some time past the URL timestamp expiration.
        nowStub.returns(3600389016959);
        await expectNoPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SWG_CLIENT
        );
        await xhrMock.verify();
      });

      it('should NOT pingback other events', async () => {
        for (const eventKey in AnalyticsEvent) {
          const event = AnalyticsEvent[eventKey];
          if (PINGBACK_EVENTS[event]) {
            continue;
          }
          await expectNoPingback(event, EventOriginator.SWG_CLIENT);
          await xhrMock.verify();
        }
      });
    });

    describe('SHOWCASE_CLIENT', () => {
      it('should pingback IMPRESSION_REGWALL', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_REGWALL,
          EventOriginator.SHOWCASE_CLIENT,
          EntitlementSource.PUBLISHER_ENTITLEMENT
        ));

      it('should pingback EVENT_UNLOCKED_BY_METER', () =>
        expectPingback(
          AnalyticsEvent.EVENT_UNLOCKED_BY_METER,
          EventOriginator.SHOWCASE_CLIENT,
          EntitlementSource.PUBLISHER_ENTITLEMENT
        ));

      it('should pingback EVENT_UNLOCKED_BY_SUBSCRIPTION', () =>
        expectPingback(
          AnalyticsEvent.EVENT_UNLOCKED_BY_SUBSCRIPTION,
          EventOriginator.SHOWCASE_CLIENT,
          EntitlementSource.PUBLISHER_ENTITLEMENT,
          getEventParams(true)
        ));

      it('should pingback EVENT_UNLOCKED_FREE_PAGE', () =>
        expectPingback(
          AnalyticsEvent.EVENT_UNLOCKED_FREE_PAGE,
          EventOriginator.SHOWCASE_CLIENT,
          EntitlementSource.PUBLISHER_ENTITLEMENT
        ));

      it('should pingback IMPRESSION_PAYWALL', () =>
        expectPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SHOWCASE_CLIENT,
          EntitlementSource.PUBLISHER_ENTITLEMENT
        ));

      it('should NOT pingback on invalid GAA params', async () => {
        // Stub out Date.now() to some time past the URL timestamp expiration.
        nowStub.returns(3600389016959);
        await expectNoPingback(
          AnalyticsEvent.IMPRESSION_PAYWALL,
          EventOriginator.SHOWCASE_CLIENT
        );
        await xhrMock.verify();
      });

      it('should NOT pingback other events', async () => {
        for (const eventKey in AnalyticsEvent) {
          const event = AnalyticsEvent[eventKey];
          if (PINGBACK_EVENTS[event]) {
            continue;
          }
          await expectNoPingback(event, EventOriginator.SHOWCASE_CLIENT);
          await xhrMock.verify();
        }
      });
    });

    it('should NOT pingback from other originators', async () => {
      const SKIP = {
        [EventOriginator.UNKNOWN_CLIENT]: 1,
        [EventOriginator.SWG_CLIENT]: 1,
        [EventOriginator.SWG_SERVER]: 1,
        [EventOriginator.SHOWCASE_CLIENT]: 1,
      };
      for (const originKey in EventOriginator) {
        const origin = EventOriginator[originKey];
        if (SKIP[origin]) {
          continue;
        }
        for (const eventKey in AnalyticsEvent) {
          if (eventKey == 'UNKNOWN') {
            continue;
          }
          expectNoPingback(AnalyticsEvent[eventKey], origin);
          xhrMock.verify();
        }
      }
      return eventManager.lastAction_;
    });
  });

  describe('flow', () => {
    let toastOpenStub;
    let toast;

    beforeEach(() => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(null))
        .atLeast(0);
      storageMock
        .expects('set')
        .withArgs('ents')
        .returns(Promise.resolve())
        .atLeast(0);
    });

    function expectToastShown(value) {
      // Emulate promsie.
      storageMock
        .expects('get')
        .withExactArgs('toast')
        .returns({
          then: (callback) => {
            callback(value);
          },
        });
    }

    function expectGetIsReadyToPayToBeCalled(value) {
      storageMock
        .expects('get')
        .withExactArgs('isreadytopay')
        .returns(Promise.resolve(value))
        .once();
    }

    it('should set toast flag', () => {
      storageMock.expects('set').withExactArgs('toast', '1').once();
      manager.setToastShown(true);
    });

    it('should unset toast flag', () => {
      storageMock.expects('set').withExactArgs('toast', '0').once();
      manager.setToastShown(false);
    });

    it('should trigger entitlements event for empty response', async () => {
      storageMock.expects('get').withExactArgs('toast').never();
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
      expectNoResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements1 = await manager.getEntitlements();
      expect(entitlements1.enablesAny()).to.be.false;
      expect(callbacks.hasEntitlementsResponsePending()).to.be.true;

      const entitlements2 = await new Promise((resolve) => {
        callbacks.setOnEntitlementsResponse(resolve);
      });
      expect(entitlements2.enablesAny()).to.be.false;
      expect(toastOpenStub).to.not.be.called;
    });

    it('should trigger entitlements event for Google response', async () => {
      expectToastShown('0');
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
      expectGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements1 = await manager.getEntitlements();
      expect(entitlements1.enablesAny()).to.be.true;
      expect(entitlements1.enablesThis()).to.be.true;
      expect(entitlements1.getEntitlementForThis().source).to.equal('google');
      expect(callbacks.hasEntitlementsResponsePending()).to.be.true;

      const entitlements2 = await new Promise((resolve) => {
        callbacks.setOnEntitlementsResponse(resolve);
      });
      expect(entitlements2.getEntitlementForThis().source).to.equal('google');
      expect(toastOpenStub).to.be.calledOnce;
      expect(toast.args_.source).to.equal('google');
    });

    it('should trigger entitlements event with readyToPay true', async () => {
      expectToastShown('0');
      storageMock.expects('set').withArgs('isreadytopay', 'true').once();
      expectGetIsReadyToPayToBeCalled('true');
      expectGoogleResponse(/* options */ undefined, /* isReadyToPay */ true);
      analyticsMock.expects('setReadyToPay').withExactArgs(true).once();
      expectGetSwgUserTokenToBeCalled();
      const entitlements = await manager.getEntitlements();
      expect(entitlements.isReadyToPay).to.be.true;
    });

    it('should trigger entitlements event with readyToPay false', async () => {
      expectToastShown('0');
      storageMock.expects('set').withArgs('isreadytopay', 'false').once();
      expectGetIsReadyToPayToBeCalled('false');
      expectGoogleResponse(/* options */ undefined, /* isReadyToPay */ false);
      analyticsMock.expects('setReadyToPay').withExactArgs(false).once();
      expectGetSwgUserTokenToBeCalled();
      const entitlements = await manager.getEntitlements();
      expect(entitlements.isReadyToPay).to.be.false;
    });

    it('should trigger entitlements with default readyToPay', async () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      expectGoogleResponse();
      analyticsMock.expects('setReadyToPay').withExactArgs(false).once();
      expectGetSwgUserTokenToBeCalled();
      const entitlements = await manager.getEntitlements();
      expect(entitlements.isReadyToPay).to.be.false;
    });

    it('should tolerate expired response from server', async () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withArgs('toast').never();
      expectGoogleResponse({
        exp: Date.now() / 1000 - 10000, // Far back.
      });
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesAny()).to.be.true;
      expect(entitlements.enablesThis()).to.be.true;
      expect(entitlements.getEntitlementForThis().source).to.equal('google');
    });

    it('should acknowledge and update the toast bit', async () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withExactArgs('toast', '1').once();
      expectGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesThis()).to.be.true;
      entitlements.ack();
    });

    it('should acknowledge and NOT update the toast bit', async () => {
      storageMock.expects('set').withArgs('toast').never();
      expectGetIsReadyToPayToBeCalled(null);
      expectNoResponse();
      analyticsMock.expects('setReadyToPay').withExactArgs(false);
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesThis()).to.be.false;
      entitlements.ack();
    });

    it('should trigger entitlements event for non-Google response', async () => {
      expectToastShown('0');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withExactArgs('toast', '1').once();
      expectNonGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements1 = await manager.getEntitlements();
      expect(entitlements1.enablesAny()).to.be.true;
      expect(entitlements1.enablesThis()).to.be.true;
      expect(entitlements1.getEntitlementForThis().source).to.equal('pub1');
      expect(callbacks.hasEntitlementsResponsePending()).to.be.true;

      const entitlements2 = await new Promise((resolve) => {
        callbacks.setOnEntitlementsResponse(resolve);
      });
      entitlements2.ack();
      expect(entitlements2.getEntitlementForThis().source).to.equal('pub1');
      expect(toastOpenStub).to.be.calledOnce;
      expect(toast.args_.source).to.equal('pub1');
    });

    it('should NOT trigger entitlements when notification is blocked', async () => {
      const resp = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      });
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () => Promise.resolve(JSON.stringify(resp)),
          })
        )
        .once();
      expectGetIsReadyToPayToBeCalled(null);
      expectGetSwgUserTokenToBeCalled();
      manager.blockNextNotification();

      const entitlements = await manager.getEntitlements();
      expect(manager.blockNextNotification_).to.be.false; // Reset.
      expect(entitlements.enablesThis()).to.be.true;
      expect(callbacks.hasEntitlementsResponsePending()).to.be.false;
      expect(toastOpenStub).to.not.be.called;
    });

    it('should NOT trigger toast when toast is blocked', async () => {
      const resp = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      });
      xhrMock
        .expects('fetch')
        .returns(
          Promise.resolve({
            text: () => Promise.resolve(JSON.stringify(resp)),
          })
        )
        .once();
      expectGetIsReadyToPayToBeCalled(null);
      expectGetSwgUserTokenToBeCalled();
      manager.blockNextToast();

      const entitlements = await manager.getEntitlements();
      expect(manager.blockNextToast_).to.be.false; // Reset.
      expect(entitlements.enablesThis()).to.be.true;
      expect(callbacks.hasEntitlementsResponsePending()).to.be.true;
      expect(toastOpenStub).to.not.be.called;
    });

    it('should reset blocked state', () => {
      manager.blockNextNotification();
      expect(manager.blockNextNotification_).to.be.true;
      manager.unblockNextNotification();
      expect(manager.blockNextNotification_).to.be.false; // Reset.
    });

    it('should NOT show toast if already shown', async () => {
      expectToastShown('1');
      expectGetIsReadyToPayToBeCalled(null);
      storageMock.expects('set').withArgs('toast').never();
      expectGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.getEntitlementForThis().source).to.equal('google');
      expect(toastOpenStub).to.not.be.called;
    });
  });

  describe('flow with cache', () => {
    beforeEach(() => {
      sandbox.stub(Toast.prototype, 'open');
      storageMock
        .expects('get')
        .withArgs('toast')
        .returns(Promise.resolve(null))
        .atLeast(0);
      storageMock
        .expects('set')
        .withArgs('toast')
        .returns(Promise.resolve(null))
        .atLeast(0);
    });

    function expectGetIsReadyToPayToBeCalled(value) {
      storageMock
        .expects('get')
        .withExactArgs('isreadytopay')
        .returns(Promise.resolve(value))
        .atLeast(0);
    }

    it('should not store empty response', async () => {
      expectNoResponse();
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(null))
        .once();
      storageMock.expects('set').withExactArgs('ents').never();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesAny()).to.be.false;
    });

    it('should store non-empty Google response', async () => {
      const raw = expectGoogleResponse()['signedEntitlements'];
      expect(raw).to.match(/e30\.eyJpc3MiOiJnb/);
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(null))
        .once();
      storageMock
        .expects('set')
        .withExactArgs('ents', raw)
        .returns(Promise.resolve())
        .once();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesAny()).to.be.true;
      expect(entitlements.enablesThis()).to.be.true;
      expect(entitlements.getEntitlementForThis().source).to.equal('google');
    });

    it('should store non-empty non-Google response', async () => {
      const raw = expectNonGoogleResponse()['signedEntitlements'];
      expect(raw).to.match(/e30\.eyJpc3MiOiJnb/);
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(null))
        .once();
      storageMock
        .expects('set')
        .withExactArgs('ents', raw)
        .returns(Promise.resolve())
        .once();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      expect(entitlements.enablesAny()).to.be.true;
      expect(entitlements.enablesThis()).to.be.true;
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
    });

    it('should retrieve a Google response from cache, rtp default', async () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').never();
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
        entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
        isUserRegistered: true,
        pingbackUrl: ENTITLEMENTS_URL + `?encodedParams=${noClientTypeParams}`,
      });
      manager.reset(true);

      const entitlements = await manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0); // Retries are reset.
      expect(entitlements.enablesAny()).to.be.true;
      expect(entitlements.enablesThis()).to.be.true;
      expect(entitlements.getEntitlementForThis().source).to.equal('google');
      expect(entitlements.isReadyToPay).to.be.false;
    });

    it('should retrieve a Google response from cache, rtp true', async () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled('true');
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').never();
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
        entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
        isUserRegistered: true,
        pingbackUrl: ENTITLEMENTS_URL + `?encodedParams=${noClientTypeParams}`,
      });
      manager.reset(true);
      analyticsMock.expects('setReadyToPay').withExactArgs(true);

      const entitlements = await manager.getEntitlements();
      expect(entitlements.isReadyToPay).to.be.true;
    });

    it('should retrieve a Google response from cache, rtp false', async () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled('false');
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').never();
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
        entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
        isUserRegistered: true,
        pingbackUrl: ENTITLEMENTS_URL + `?encodedParams=${noClientTypeParams}`,
      });
      manager.reset(true);
      analyticsMock.expects('setReadyToPay').withExactArgs(false);

      const entitlements = await manager.getEntitlements();
      expect(entitlements.isReadyToPay).to.be.false;
    });

    it('should retrieve a non-Google response from cache', async () => {
      const raw = entitlementsResponse({
        source: 'pub1',
        products: ['pub1:label1'],
        subscriptionToken: 's2',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').never();
      expectEntitlementPingback({
        entitlementSource: EntitlementSource.GOOGLE_SUBSCRIBER_ENTITLEMENT,
        entitlementResult: EntitlementResult.UNLOCKED_SUBSCRIBER,
        isUserRegistered: true,
        pingbackUrl: ENTITLEMENTS_URL + `?encodedParams=${noClientTypeParams}`,
      });
      manager.reset(true);

      const entitlements = await manager.getEntitlements();
      expect(manager.positiveRetries_).to.equal(0); // Retries are reset.
      expect(entitlements.enablesAny()).to.be.true;
      expect(entitlements.enablesThis()).to.be.true;
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
      expect(entitlements.isReadyToPay).to.be.false;
    });

    it('should not accept expired response in cache', async () => {
      const raw = entitlementsResponse(
        {
          source: 'google',
          products: ['pub1:label1'],
          subscriptionToken: 's1',
        },
        {
          exp: Date.now() / 1000 - 100000, // Far back.
        }
      )['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').once();
      expectNonGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      // Cached response is from Google, but refresh response is from "pub1".
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
    });

    it('should not accept response in cache for a different product', async () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:other'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').once();
      expectNonGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      // Cached response is from Google, but refresh response is from "pub1".
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
    });

    it('should not accept empty response in cache', async () => {
      const raw = entitlementsResponse({})['signedEntitlements'];
      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve(raw))
        .once();
      storageMock.expects('set').withArgs('ents').once();
      expectNonGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      // Cached response is from Google, but refresh response is from "pub1".
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');
    });

    it('should tolerate malformed cache', async () => {
      // Handle async error caused by invalid token.
      let threwErrorAfterTimeout = false;
      sandbox.stub(win, 'setTimeout').callsFake((callback) => {
        try {
          callback();
        } catch (err) {
          expect(err.toString()).to.contain('Invalid token: "VeRy BroKen"');
          threwErrorAfterTimeout = true;
        }
      });

      expectGetIsReadyToPayToBeCalled(null);
      storageMock
        .expects('get')
        .withExactArgs('ents')
        .returns(Promise.resolve('VeRy BroKen'))
        .once();
      storageMock.expects('set').withArgs('ents').once();
      expectNonGoogleResponse();
      expectGetSwgUserTokenToBeCalled();

      const entitlements = await manager.getEntitlements();
      // Cached response is from Google, but refresh response is from "pub1".
      expect(entitlements.getEntitlementForThis().source).to.equal('pub1');

      // Expect async error.
      expect(threwErrorAfterTimeout).to.be.true;
    });

    it('should push entitlements', () => {
      const raw = entitlementsResponse({
        source: 'google',
        products: ['pub1:label1'],
        subscriptionToken: 's1',
      })['signedEntitlements'];
      storageMock
        .expects('set')
        .withExactArgs('ents', raw)
        .returns(Promise.resolve())
        .once();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.true;
      manager.reset(true);
    });

    it('should ignore expired pushed entitlements', () => {
      const raw = entitlementsResponse(
        {
          source: 'google',
          products: ['pub1:label1'],
          subscriptionToken: 's1',
        },
        {
          exp: Date.now() / 1000 - 10000, // Far back.
        }
      )['signedEntitlements'];
      storageMock.expects('set').withArgs('ents').never();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.false;
    });

    it('should ignore unrelated pushed entitlements', () => {
      const raw = entitlementsResponse(
        {
          source: 'google',
          products: ['pub1:other'],
          subscriptionToken: 's1',
        },
        {}
      )['signedEntitlements'];
      storageMock.expects('set').withArgs('ents').never();
      const res = manager.pushNextEntitlements(raw);
      expect(res).to.be.false;
    });

    it('should ignore malformed pushed entitlements', () => {
      storageMock.expects('set').withArgs('ents').never();
      sandbox.stub(win, 'setTimeout').returns(1);
      const res = manager.pushNextEntitlements('VeRy BroKen');
      expect(res).to.be.false;
    });

    it('should reset w/o clearing cache', () => {
      storageMock.expects('remove').never();
      manager.reset();
    });

    it('should reset and clearing cache', () => {
      storageMock.expects('remove').withExactArgs('ents').once();
      storageMock.expects('remove').withExactArgs('isreadytopay').once();
      manager.reset(true);
    });
  });
});
