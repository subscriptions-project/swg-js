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

import {installRuntime, runtimeInstance} from './runtime';


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
    installRuntime(win);
    dep(function() {
      progress += '3';
    });
    dep(function() {
      progress += '4';
    });

    // Wait for ready signal.
    yield runtimeInstance.whenReady();
    expect(progress).to.equal('1234');

    // Few more.
    dep(function() {
      progress += '5';
    });
    dep(function() {
      progress += '6';
    });
    yield runtimeInstance.whenReady();
    expect(progress).to.equal('123456');
  });

  it('should reuse the same runtime on multiple runs', () => {
    installRuntime(win);
    const runtime1 = runtimeInstance;
    installRuntime(win);
    expect(runtimeInstance).to.equal(runtime1);
  });

  it('handles recursive calls after installation', function* () {
    installRuntime(win);
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
    yield runtimeInstance.whenReady();
    yield runtimeInstance.whenReady();
    yield runtimeInstance.whenReady();
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
    installRuntime(win);
    yield runtimeInstance.whenReady();
    yield runtimeInstance.whenReady();
    yield runtimeInstance.whenReady();
    expect(progress).to.equal('123');
  });
});
