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
  ActivityPorts,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  ConfiguredRuntime,
  Runtime,
  installRuntime,
  getRuntime,
} from './runtime';
import {DialogManager} from '../components/dialog-manager';
import {
  LinkStartFlow,
  LinkCompleteFlow,
} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';
import {
  PayStartFlow,
} from './pay-flow';


describes.realWin('installRuntime', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  function dep(callback) {
    (win.SUBSCRIPTIONS = win.SUBSCRIPTIONS || []).push(callback);
  }

  it('should chain and execute dependencies in order', function* () {
    // Before runtime is installed.
    let progress = '';
    dep(function() {
      progress += '1';
    });
    dep(function() {
      progress += '2';
    });
    expect(progress).to.equal('');

    // Install runtime and schedule few more dependencies.
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    dep(function() {
      progress += '3';
    });
    dep(function() {
      progress += '4';
    });

    // Wait for ready signal.
    yield getRuntime().whenReady();
    expect(progress).to.equal('1234');

    // Few more.
    dep(function() {
      progress += '5';
    });
    dep(function() {
      progress += '6';
    });
    yield getRuntime().whenReady();
    expect(progress).to.equal('123456');
  });

  it('should reuse the same runtime on multiple runs', () => {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    const runtime1 = getRuntime();
    installRuntime(win);
    expect(getRuntime()).to.equal(runtime1);
  });

  it('handles recursive calls after installation', function* () {
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });

  it('handles recursive calls before installation', function* () {
    let progress = '';
    dep(() => {
      progress += '1';
      dep(() => {
        progress += '2';
        dep(() => {
          progress += '3';
        });
      });
    });
    try {
      installRuntime(win);
    } catch (e) {
      // Page doesn't have valid subscription and hence this function throws.
    }
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    yield getRuntime().whenReady();
    expect(progress).to.equal('123');
  });
});


describes.realWin('Runtime', {}, env => {
  let win;
  let config;
  let runtime;
  let configuredRuntime;
  let configuredRuntimeMock;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig({publicationId: 'pub1', label: null});
    sandbox.stub(
        PageConfigResolver.prototype,
        'resolveConfig',
        () => Promise.resolve(config));
    runtime = new Runtime(win);
    return runtime.configured().then(cr => {
      configuredRuntime = cr;
      configuredRuntimeMock = sandbox.mock(configuredRuntime);
    });
  });

  afterEach(() => {
    configuredRuntimeMock.verify();
  });

  it('should should initialize correctly', () => {
    expect(configuredRuntime.hasStarted()).to.be.false;
    expect(configuredRuntime.pageConfig()).to.equal(config);
  });

  it('should should delegate "start"', () => {
    configuredRuntimeMock.expects('start').once();
    return runtime.start();
  });

  it('should should delegate "startSubscriptionsFlowIfNeeded"', () => {
    configuredRuntimeMock.expects('startSubscriptionsFlowIfNeeded').once();
    return runtime.startSubscriptionsFlowIfNeeded();
  });

  it('should should delegate "getEntitlements"', () => {
    const ents = {};
    configuredRuntimeMock.expects('getEntitlements')
        .returns(Promise.resolve(ents));
    return expect(runtime.getEntitlements()).to.eventually.equal(ents);
  });

  it('should should delegate "reset"', () => {
    configuredRuntimeMock.expects('reset').once();
    return expect(runtime.reset()).to.eventually.be.undefined;
  });

  it('should should delegate "showOffers"', () => {
    const resp = {};
    configuredRuntimeMock.expects('showOffers')
        .returns(Promise.resolve(resp));
    return expect(runtime.showOffers()).to.eventually.equal(resp);
  });

  it('should should delegate "subscribe"', () => {
    const resp = {};
    configuredRuntimeMock.expects('subscribe')
        .withExactArgs('sku1')
        .returns(Promise.resolve(resp));
    return expect(runtime.subscribe('sku1')).to.eventually.equal(resp);
  });
});


describes.realWin('ConfiguredRuntime', {}, env => {
  let win;
  let config;
  let runtime;
  let entitlementsManagerMock;
  let activityResultCallbacks;

  beforeEach(() => {
    win = env.win;
    activityResultCallbacks = {};
    sandbox.stub(ActivityPorts.prototype, 'onResult',
        function(requestId, callback) {
          if (activityResultCallbacks[requestId]) {
            throw new Error('duplicate');
          }
          activityResultCallbacks[requestId] = callback;
        });
    config = new PageConfig({publicationId: 'pub1', label: null});
    runtime = new ConfiguredRuntime(win, config);
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager_);
  });

  afterEach(() => {
    entitlementsManagerMock.verify();
  });

  function returnActivity(requestId, code, opt_dataOrError) {
    const activityResult = new ActivityResult(code, opt_dataOrError);
    const activityResultPromise = Promise.resolve(activityResult);
    const promise = activityResultCallbacks[requestId]({
      getTargetOrigin() {
        return 'https://example.com';
      },
      acceptResult() {
        return activityResultPromise;
      },
    });
    return activityResultPromise.then(() => {
      // Skip microtask.
      return promise;
    });
  }

  it('should should initialize deps', () => {
    expect(runtime.win()).to.equal(win);
    expect(runtime.pageConfig()).to.equal(config);
    expect(runtime.activities()).to.be.instanceof(ActivityPorts);
    expect(runtime.dialogManager()).to.be.instanceof(DialogManager);
  });

  it('should NOT starts automatically if access-control is not found', () => {
    runtime.startSubscriptionsFlowIfNeeded();
    expect(runtime.hasStarted()).to.be.false;
  });

  it('should NOT start automatically if access-control=manual', () => {
    entitlementsManagerMock
        .expects('getEntitlements')
        .returns(Promise.resolve({}));
    const meta = win.document.createElement('meta');
    meta.setAttribute('content', 'manual');
    meta.setAttribute('name', 'access-control');
    win.document.head.appendChild(meta);
    expect(runtime.hasStarted()).to.be.false;
    runtime.startSubscriptionsFlowIfNeeded();
    expect(runtime.hasStarted()).to.be.false;
    runtime.start();
    expect(runtime.hasStarted()).to.be.true;
  });

  it('should reset entitlements', () => {
    entitlementsManagerMock.expects('reset').once();
    runtime.reset();
  });

  it('should start LinkStartFlow', () => {
    const startStub = sandbox.stub(
        LinkStartFlow.prototype,
        'start',
        () => Promise.resolve());
    return runtime.linkAccount().then(() => {
      expect(startStub).to.be.calledOnce;
    });
  });

  it('should configure and start LinkCompleteFlow', () => {
    expect(activityResultCallbacks['swg-link-continue']).to.exist;
    const startStub = sandbox.stub(
        LinkCompleteFlow.prototype,
        'start',
        () => Promise.resolve());
    return returnActivity('swg-link-continue', ActivityResultCode.OK)
        .then(() => {
          expect(startStub).to.be.calledOnce;
        });
  });

  it('should start PayStartFlow', () => {
    let flowInstance;
    const startStub = sandbox.stub(
        PayStartFlow.prototype,
        'start',
        function() {
          flowInstance = this;
          return Promise.resolve();
        });
    return runtime.subscribe('sku1').then(() => {
      expect(startStub).to.be.calledOnce;
      expect(flowInstance.sku_).to.equal('sku1');
    });
  });

  it('should configure and start PayCompleteFlow', () => {
    expect(activityResultCallbacks['swg-pay']).to.exist;
    const stub = sandbox.stub(
        runtime.callbacks(),
        'triggerSubscribeResponse');
    return returnActivity('swg-pay', ActivityResultCode.OK)
        // Succeeds or fails is not important for this test.
        .catch(() => {})
        .then(() => {
          expect(stub).to.be.calledOnce;
        });
  });
});
