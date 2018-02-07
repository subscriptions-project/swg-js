/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {
  PayStartFlow,
  PayCompleteFlow,
  parseSubscriptionResponse,
  parseUserData,
} from './pay-flow';
import {SubscribeResponse} from '../api/subscribe-response';
import * as sinon from 'sinon';

const INTEGR_DATA_STRING =
    'eyJzd2dDYWxsYmFja0RhdGEiOnsicHVyY2hhc2VEYXRhIjoie1wib3JkZXJJZFwiOlwiT1' +
    'JERVJcIn0iLCJwdXJjaGFzZURhdGFTaWduYXR1cmUiOiJQRF9TSUciLCJpZFRva2VuIjoi' +
    'ZXlKaGJHY2lPaUpTVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnpkV0lpT2lKSlJGOV' +
    'VUMHNpZlEuU0lHIn19';

const EMPTY_ID_TOK = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9' +
    '.eyJzdWIiOiJJRF9UT0sifQ.SIG';

const INTEGR_DATA_OBJ = {
  'integratorClientCallbackData': INTEGR_DATA_STRING,
};


describes.realWin('PayStartFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let flow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    flow = new PayStartFlow(runtime, 'sku1');
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  it('should have valid flow constructed', () => {
    activitiesMock.expects('open').withExactArgs(
        'swg-pay',
        sinon.match.string,
        '_blank',
        {
          'paymentRequest': {
            'apiVersion': 1,
            'allowedPaymentMethods': ['CARD'],
            'publisherId': 'pub1',
            'publicationId': 'pub1',
            'swg': {
              'publisherId': 'pub1',
              'publicationId': 'pub1',
              'skuId': 'sku1',
            },
          },
        },
        {})
        .once();
    const flowPromise = flow.start();
    return expect(flowPromise).to.eventually.be.undefined;
  });
});


describes.realWin('PayCompleteFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let flow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    flow = new PayCompleteFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
  });

  it('should have valid flow constructed', () => {
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        sinon.match.string,
        {
          publisherId: 'pub1',
          publicationId: 'pub1',
        })
        .returns(Promise.resolve(port));
    return flow.start();
  });

  describe('payments response', () => {
    let startStub;
    let startCallback;
    let triggerPromise;
    let port;

    beforeEach(() => {
      startStub = sandbox.stub(PayCompleteFlow.prototype, 'start');
      startCallback = undefined;
      activitiesMock.expects('onResult').withExactArgs(
          'swg-pay',
          sinon.match(arg => {
            startCallback = arg;
            return true;
          }))
          .once();
      triggerPromise = undefined;
      callbacksMock.expects('triggerSubscribeResponse')
          .withExactArgs(sinon.match(arg => {
            triggerPromise = arg;
            return true;
          }))
          .once();
      port = new ActivityPort();
    });

    it('should NOT start flow on incorrect payments response', () => {
      PayCompleteFlow.configurePending(runtime);
      const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ);
      sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
      return startCallback(port).then(() => {
        throw new Error('must have failed');
      }, reason => {
        expect(() => {throw reason;}).to.throw(/channel mismatch/);
        expect(startStub).to.not.be.called;
        expect(triggerPromise).to.exist;
        return triggerPromise.then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/channel mismatch/);
        });
      });
    });

    // TODO(dvoytenko): support payload decryption.
    it.skip('should require channel security', () => {
      const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
          'REDIRECT', location.origin, true, false);
      sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
      PayCompleteFlow.configurePending(runtime);
      return startCallback(port).then(() => {
        throw new Error('must have failed');
      }, reason => {
        expect(() => {throw reason;}).to.throw(/channel mismatch/);
        return triggerPromise.then(() => {
          throw new Error('must have failed');
        }, reason => {
          expect(() => {throw reason;}).to.throw(/channel mismatch/);
        });
      });
    });

    it('should start flow on correct payment response', () => {
      const result = new ActivityResult(ActivityResultCode.OK, INTEGR_DATA_OBJ,
          'POPUP', location.origin, true, true);
      sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
      PayCompleteFlow.configurePending(runtime);
      return startCallback(port).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.raw).to.equal(INTEGR_DATA_STRING);
      });
    });
  });
});


describe('parseSubscriptionResponse', () => {
  it('should parse a string response', () => {
    const sr = parseSubscriptionResponse(INTEGR_DATA_STRING);
    expect(sr.raw).to.equal(INTEGR_DATA_STRING);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
  });

  it('should parse a json response', () => {
    const sr = parseSubscriptionResponse(INTEGR_DATA_OBJ);
    expect(sr.raw).to.equal(INTEGR_DATA_STRING);
    expect(sr.purchaseData.raw).to.equal('{\"orderId\":\"ORDER\"}');
    expect(sr.purchaseData.signature).to.equal('PD_SIG');
    expect(sr.userData.idToken).to.equal(EMPTY_ID_TOK);
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
});
