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

import {installRuntime, getRuntime, Runtime} from './runtime';

describes.realWin('installRuntime', {}, env => {
  let win;
  let runtime;

  beforeEach(() => {
    win = env.win;
    runtime = new Runtime(win);
    sandbox.stub(runtime.auth_, 'start', () => {
      runtime.subscriptionState_.shouldRetry = false;
      return Promise.resolve();
    });
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

  it('starts automatically if access-control is not found', function() {
    runtime.startSubscriptionsFlowIfNeeded();
    expect(runtime.subscriptionPromise_).to.not.be.null;
  });

  it('doesn\'t start automatically if access-control is found', function() {
    const meta = win.document.createElement('meta');
    meta.setAttribute('content', 'manual');
    meta.setAttribute('name', 'access-control');
    win.document.head.appendChild(meta);
    expect(runtime.subscriptionPromise_).to.be.null;
    runtime.startSubscriptionsFlowIfNeeded();
    expect(runtime.subscriptionPromise_).to.be.null;
    runtime.start();
    expect(runtime.subscriptionPromise_).to.not.be.null;
  });

  it('throws when start() is called twice', function() {
    runtime.startSubscriptionsFlowIfNeeded();
    expect(() => runtime.start()).to.throw(/flow can only be started once/);
  });
});
