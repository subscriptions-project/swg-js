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

import {
  ActivityPort,
} from 'web-activities/activity-ports';
import {ConfiguredRuntime} from './runtime';
import {Entitlements} from '../api/entitlements';
import {PageConfig} from '../model/page-config';
import {PayClient} from './pay-client';
import {
  PayStartFlow,
  PayCompleteFlow,
  parseEntitlements,
  parseSubscriptionResponse,
  parseUserData,
} from './pay-flow';
import {PurchaseData, SubscribeResponse} from '../api/subscribe-response';
import {UserData} from '../api/user-data';
import * as sinon from 'sinon';


const INTEGR_DATA_STRING =
    'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
    'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
    'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
    'VUMHNpZlEuU0lHIiwic2lnbmVkRW50aXRsZW1lbnRzIjoiZXlKaGJHY2lPaUpJVXpJMU5p' +
    'SXNJblI1Y0NJNklrcFhWQ0o5LmV5SmxiblJwZEd4bGJXVnVkSE1pT2x0N0luTnZkWEpqWl' +
    'NJNklsUkZVMVFpZlYxOS5TSUcifX0=';

const INTEGR_DATA_STRING_NO_ENTITLEMENTS =
    'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
    'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
    'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
    'VUMHNpZlEuU0lHIn19';

const EMPTY_ID_TOK = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiJJRF9UT0sifQ.SIG';

const ENTITLEMENTS_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJlbnRpdGxlbWVudHMiOlt7InNvdXJjZSI6IlRFU1QifV19.SIG';

const INTEGR_DATA_OBJ = {
  'integratorClientCallbackData': INTEGR_DATA_STRING,
};

const INTEGR_DATA_OBJ_NO_ENTITLEMENTS = {
  'integratorClientCallbackData': INTEGR_DATA_STRING_NO_ENTITLEMENTS,
};

const INTEGR_DATA_OBJ_DECODED = {
  'swgCallbackData': {
    'purchaseData': '{"orderId":"ORDER"}',
    'purchaseDataSignature': 'PD_SIG',
    'idToken': EMPTY_ID_TOK,
    'signedEntitlements': ENTITLEMENTS_JWT,
  },
};

const INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS = {
  'swgCallbackData': {
    'purchaseData': '{"orderId":"ORDER"}',
    'purchaseDataSignature': 'PD_SIG',
    'idToken': EMPTY_ID_TOK,
  },
};


describes.realWin('PayStartFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let payClientMock;
  let dialogManagerMock;
  let callbacksMock;
  let flow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    payClientMock = sandbox.mock(runtime.payClient());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    callbacksMock = sandbox.mock(runtime.callbacks());
    flow = new PayStartFlow(runtime, 'sku1');
  });

  afterEach(() => {
    payClientMock.verify();
    dialogManagerMock.verify();
    callbacksMock.verify();
  });

  it('should have valid flow constructed', () => {
    const popupWin = {};
    dialogManagerMock.expects('popupOpened')
        .withExactArgs(popupWin)
        .once();
    callbacksMock.expects('triggerFlowStarted')
        .withExactArgs('subscribe', {sku: 'sku1'})
        .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    payClientMock.expects('start').withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': '$payEnvironment$',
          'playEnvironment': '$playEnvironment$',
          'swg': {
            'publicationId': 'pub1',
            'skuId': 'sku1',
          },
        },
        {
          forceRedirect: false,
        })
        .returns(popupWin)
        .once();
    const flowPromise = flow.start();
    return expect(flowPromise).to.eventually.be.undefined;
  });

  it('should force redirect mode', () => {
    runtime.configure({windowOpenMode: 'redirect'});
    dialogManagerMock.expects('popupOpened')
        .withExactArgs(null)
        .once();
    payClientMock.expects('start').withExactArgs(
        {
          'apiVersion': 1,
          'allowedPaymentMethods': ['CARD'],
          'environment': '$payEnvironment$',
          'playEnvironment': '$playEnvironment$',
          'swg': {
            'publicationId': 'pub1',
            'skuId': 'sku1',
          },
        },
        {
          forceRedirect: true,
        })
        .returns(null)
        .once();
    flow.start();
  });
});


describes.realWin('PayCompleteFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let entitlementsManagerMock;
  let dialogManagerMock;
  let responseCallback;
  let flow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    responseCallback = null;
    sandbox.stub(PayClient.prototype, 'onResponse', callback => {
      if (responseCallback) {
        throw new Error('duplicated onResponse');
      }
      responseCallback = callback;
    });
    runtime = new ConfiguredRuntime(win, pageConfig);
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    flow = new PayCompleteFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
    entitlementsManagerMock.verify();
  });

  it('should have valid flow constructed', () => {
    const purchaseData = new PurchaseData();
    const userData = new UserData('ID_TOK', {
      'email': 'test@example.org',
    });
    const entitlements = new Entitlements('service1', 'RaW', [], null);
    const response = new SubscribeResponse(
        'RaW', purchaseData, userData, entitlements);
    entitlementsManagerMock.expects('pushNextEntitlements')
        .withExactArgs(sinon.match(arg => {
          return arg === 'RaW';
        }))
        .once();
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          idToken: 'ID_TOK',
        })
        .returns(Promise.resolve(port));
    return flow.start(response);
  });

  it('should have valid flow constructed w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = new UserData('ID_TOK', {
      'email': 'test@example.org',
    });
    const response = new SubscribeResponse('RaW', purchaseData, userData, null);
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/payconfirmiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          loginHint: 'test@example.org',
        })
        .returns(Promise.resolve(port));
    return flow.start(response);
  });

  it('should complete the flow', () => {
    const purchaseData = new PurchaseData();
    const userData = new UserData('ID_TOK', {
      'email': 'test@example.org',
    });
    const entitlements = new Entitlements('service1', 'RaW', [], null);
    const response = new SubscribeResponse(
        'RaW', purchaseData, userData, entitlements);
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.message = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    entitlementsManagerMock.expects('reset')
        .withExactArgs(true)  // Expected positive.
        .once();
    entitlementsManagerMock.expects('pushNextEntitlements')
        .withExactArgs(sinon.match(arg => {
          return arg === 'RaW';
        }))
        .once();
    entitlementsManagerMock.expects('setToastShown')
        .withExactArgs(true)
        .once();
    entitlementsManagerMock.expects('unblockNextNotification')
        .withExactArgs()
        .once();
    const messageStub = sandbox.stub(port, 'message');
    return flow.start(response).then(() => {
      return flow.complete();
    }).then(() => {
      expect(messageStub).to.be.calledOnce.calledWith({'complete': true});
    });
  });

  it('should complete the flow w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = new UserData('ID_TOK', {
      'email': 'test@example.org',
    });
    const response = new SubscribeResponse('RaW', purchaseData, userData, null);
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.message = () => {};
    port.onMessage = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    entitlementsManagerMock.expects('reset')
        .withExactArgs(true)  // Expected positive.
        .once();
    entitlementsManagerMock.expects('pushNextEntitlements')
        .never();
    entitlementsManagerMock.expects('setToastShown')
        .withExactArgs(true)
        .once();
    entitlementsManagerMock.expects('unblockNextNotification')
        .withExactArgs()
        .once();
    const messageStub = sandbox.stub(port, 'message');
    return flow.start(response).then(() => {
      return flow.complete();
    }).then(() => {
      expect(messageStub).to.be.calledOnce.calledWith({'complete': true});
    });
  });

  it('should accept consistent entitlements via messaging', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const purchaseData = new PurchaseData();
    const userData = new UserData('ID_TOK', {
      'email': 'test@example.org',
    });
    const response = new SubscribeResponse('RaW', purchaseData, userData, null);
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.message = () => {};
    let messageHandler;
    port.onMessage = handler => {
      messageHandler = handler;
    };
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () => Promise.resolve();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    const order = [];
    entitlementsManagerMock.expects('reset')
        .withExactArgs(sinon.match(arg => {
          if (order.indexOf('reset') == -1) {
            order.push('reset');
          }
          return arg === true;  // Expected positive.
        }))
        .once();
    entitlementsManagerMock.expects('pushNextEntitlements')
        .withExactArgs(sinon.match(arg => {
          if (order.indexOf('pushNextEntitlements') == -1) {
            order.push('pushNextEntitlements');
          }
          return arg === 'ENTITLEMENTS_JWT';
        }))
        .once();
    entitlementsManagerMock.expects('setToastShown')
        .withExactArgs(true)
        .once();
    entitlementsManagerMock.expects('unblockNextNotification')
        .withExactArgs()
        .once();
    const messageStub = sandbox.stub(port, 'message');
    return flow.start(response).then(() => {
      messageHandler({
        'entitlements': 'ENTITLEMENTS_JWT',
      });
      return flow.complete();
    }).then(() => {
      expect(messageStub).to.be.calledOnce.calledWith({'complete': true});
      // Order must be strict: first reset, then pushNextEntitlements.
      expect(order).to.deep.equal([
        'reset',
        'pushNextEntitlements',
      ]);
    });
  });

  describe('payments response', () => {
    let startStub;
    let triggerPromise;

    beforeEach(() => {
      startStub = sandbox.stub(PayCompleteFlow.prototype, 'start');
      triggerPromise = undefined;
      callbacksMock.expects('triggerSubscribeResponse')
          .withExactArgs(sinon.match(arg => {
            triggerPromise = arg;
            return true;
          }))
          .once();
    });

    it('should NOT start flow on a response failure', () => {
      dialogManagerMock.expects('popupClosed').once();
      return responseCallback(Promise.reject('intentional')).then(() => {
        throw new Error('must have failed');
      }, reason => {
        expect(() => {throw reason;}).to.throw(/intentional/);
        expect(startStub).to.not.be.called;
        expect(triggerPromise).to.exist;
        return triggerPromise.then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/intentional/);
        });
      });
    });

    it('should start flow on a correct payment response', () => {
      callbacksMock.expects('triggerFlowCanceled').never();
      dialogManagerMock.expects('popupClosed').once();
      entitlementsManagerMock.expects('blockNextNotification').once();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      return responseCallback(Promise.resolve(INTEGR_DATA_OBJ)).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(startStub.args[0][0]).to.be.instanceof(SubscribeResponse);
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
        expect(response.purchaseData.signature).to.equal('PD_SIG');
        expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
        expect(JSON.parse(response.raw)).to.deep
            .equal(JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']);
        expect(completeStub).to.not.be.called;
        response.complete();
        expect(completeStub).to.be.calledOnce;
      });
    });

    it('should start flow on correct payment response w/o entitlements', () => {
      // TODO(dvoytenko, #400): cleanup once entitlements is launched.
      callbacksMock.expects('triggerFlowCanceled').never();
      dialogManagerMock.expects('popupClosed').once();
      entitlementsManagerMock.expects('blockNextNotification').once();
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_NO_ENTITLEMENTS;
      return responseCallback(Promise.resolve(result)).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(startStub.args[0][0]).to.be.instanceof(SubscribeResponse);
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
        expect(response.purchaseData.signature).to.equal('PD_SIG');
        expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
        expect(JSON.parse(response.raw)).to.deep
            .equal(JSON.parse(
                atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']);
        expect(completeStub).to.not.be.called;
        response.complete();
        expect(completeStub).to.be.calledOnce;
      });
    });

    it('should start flow on correct payment response as decoded obj', () => {
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_DECODED;
      return responseCallback(Promise.resolve(result)).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
        expect(response.purchaseData.signature).to.equal('PD_SIG');
        expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
        expect(JSON.parse(response.raw)).to.deep
            .equal(JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']);
        expect(completeStub).to.not.be.called;
        response.complete();
        expect(completeStub).to.be.calledOnce;
      });
    });

    it('should start flow on decoded response w/o entitlements', () => {
      // TODO(dvoytenko, #400): cleanup once entitlements is launched.
      const completeStub = sandbox.stub(PayCompleteFlow.prototype, 'complete');
      const result = INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS;
      return responseCallback(Promise.resolve(result)).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.purchaseData.raw).to.equal('{"orderId":"ORDER"}');
        expect(response.purchaseData.signature).to.equal('PD_SIG');
        expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
        expect(JSON.parse(response.raw)).to.deep
            .equal(JSON.parse(
                atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']);
        expect(completeStub).to.not.be.called;
        response.complete();
        expect(completeStub).to.be.calledOnce;
      });
    });

    it('should NOT start flow on cancelation', () => {
      callbacksMock.expects('triggerFlowCanceled')
          .withExactArgs('subscribe')
          .once();
      dialogManagerMock.expects('popupClosed').once();
      const cancel = new DOMException('cancel', 'AbortError');
      responseCallback(Promise.reject(cancel));
      return Promise.resolve().then(() => {
        // Skip microtask.
        return Promise.resolve();
      }).then(() => {
        expect(startStub).to.not.be.called;
      });
    });
  });
});


describes.realWin('parseSubscriptionResponse', {}, env => {
  let pageConfig;
  let runtime;

  beforeEach(() => {
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(env.win, pageConfig);
  });

  it('should pass through the callback', () => {
    const complete = sandbox.spy();
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_STRING, complete);
    sr.complete();
    expect(complete).to.be.calledOnce;
  });

  it('should pass through the callback w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const complete = sandbox.spy();
    const sr = parseSubscriptionResponse(
        runtime, INTEGR_DATA_STRING_NO_ENTITLEMENTS, complete);
    sr.complete();
    expect(complete).to.be.calledOnce;
  });

  it('should parse a string response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_STRING);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
  });

  it('should parse a string response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
        runtime, INTEGR_DATA_STRING_NO_ENTITLEMENTS);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(
            atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse a json response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_OBJ);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
  });

  it('should parse a json response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
        runtime, INTEGR_DATA_OBJ_NO_ENTITLEMENTS);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(
            atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse a decoded json response', () => {
    const sr = parseSubscriptionResponse(runtime, INTEGR_DATA_OBJ_DECODED);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(atob(INTEGR_DATA_STRING))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements.raw).to.equal(ENTITLEMENTS_JWT);
  });

  it('should parse a decoded json response w/o entitlements', () => {
    // TODO(dvoytenko, #400): cleanup once entitlements is launched everywhere.
    const sr = parseSubscriptionResponse(
        runtime, INTEGR_DATA_OBJ_DECODED_NO_ENTITLEMENTS);
    expect(JSON.parse(sr.raw))
        .to.deep.equal(JSON.parse(
            atob(INTEGR_DATA_STRING_NO_ENTITLEMENTS))['swgCallbackData']);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(sr.entitlements).to.be.null;
  });

  it('should parse complete idToken', () => {
    const idToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NS' +
        'IsImVtYWlsIjoidGVzdEBleGFtcGxlLm9yZyIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlL' +
        'CJuYW1lIjoiVGVzdCBPbmUiLCJwaWN0dXJlIjoiaHR0cHM6Ly9leGFtcGxlLm9yZy9h' +
        'dmF0YXIvdGVzdCIsImdpdmVuX25hbWUiOiJUZXN0IiwiZmFtaWx5X25hbWUiOiJPbmU' +
        'ifQ.SIG';
    const ud = parseUserData({idToken});
    expect(ud.idToken).to.equal(idToken);
    expect(ud.id).to.equal('12345');
    expect(ud.email).to.equal('test@example.org');
    expect(ud.emailVerified).to.be.true;
    expect(ud.name).to.equal('Test One');
    expect(ud.givenName).to.equal('Test');
    expect(ud.familyName).to.equal('One');
    expect(ud.pictureUrl).to.equal('https://example.org/avatar/test');
  });

  it('should parse absent entitlements', () => {
    expect(parseEntitlements(runtime, {})).to.be.null;
  });

  it('should parse complete entitlements', () => {
    const ent = parseEntitlements(runtime, {
      'signedEntitlements': ENTITLEMENTS_JWT,
    });
    expect(ent.raw).to.equal(ENTITLEMENTS_JWT);
    expect(ent.entitlements[0].source).to.equal('TEST');
  });
});
