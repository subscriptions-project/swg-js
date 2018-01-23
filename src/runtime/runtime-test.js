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
  ConfiguredRuntime,
  Runtime,
  installRuntime,
  getRuntime,
} from './runtime';
import {PageConfig} from '../model/page-config';
import {PageConfigResolver} from '../model/page-config-resolver';


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
    expect(configuredRuntime.getConfig()).to.equal(config);
    expect(configuredRuntime.hasStarted()).to.be.false;
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

  it('should should delegate "showOffers"', () => {
    const resp = {};
    configuredRuntimeMock.expects('showOffers')
        .returns(Promise.resolve(resp));
    return expect(runtime.showOffers()).to.eventually.equal(resp);
  });
});


describes.realWin('ConfiguredRuntime', {}, env => {
  let win;
  let config;
  let runtime;
  let entitlementsManagerMock;

  beforeEach(() => {
    win = env.win;
    config = new PageConfig({publicationId: 'pub1', label: null});
    runtime = new ConfiguredRuntime(win, config);
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager_);
  });

  afterEach(() => {
    entitlementsManagerMock.verify();
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
});
