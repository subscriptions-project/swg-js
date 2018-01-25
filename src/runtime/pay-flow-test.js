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
} from './pay-flow';
import {SubscribeResponse} from '../api/subscribe-response';
import * as sinon from 'sinon';


describes.realWin('PayStartFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let flow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig({publicationId: 'pub1', label: null});
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    flow = new PayStartFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  it('should have valid flow constructed', () => {
    activitiesMock.expects('open').withExactArgs(
        'swg-pay',
        sinon.match.string,
        '_blank',
        {},
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
    pageConfig = new PageConfig({publicationId: 'pub1', label: null});
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
        {publicationId: 'pub1'})
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

    it('should start flow on correct payment response', () => {
      sandbox.stub(port, 'getTargetOrigin', () => location.origin);
      sandbox.stub(port, 'isTargetOriginVerified', () => true);
      sandbox.stub(port, 'isSecureChannel', () => true);
      const result = new ActivityResult(ActivityResultCode.OK, 'A');
      sandbox.stub(port, 'acceptResult', () => Promise.resolve(result));
      PayCompleteFlow.configurePending(runtime);
      return startCallback(port).then(() => {
        expect(startStub).to.be.calledOnce;
        expect(triggerPromise).to.exist;
        return triggerPromise;
      }).then(response => {
        expect(response).to.be.instanceof(SubscribeResponse);
        expect(response.raw).to.equal('A');
      });
    });

    it('should require channel security', () => {
      sandbox.stub(port, 'getTargetOrigin', () => location.origin);
      sandbox.stub(port, 'isTargetOriginVerified', () => true);
      sandbox.stub(port, 'isSecureChannel', () => false);
      const result = new ActivityResult(ActivityResultCode.OK, 'A');
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
  });
});
