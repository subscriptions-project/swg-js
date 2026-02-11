/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

import {installRuntime, resetRuntimeForTesting} from './runtime';
import {tick} from '../../test/tick';

describes.realWin('ESM Integration', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
    resetRuntimeForTesting();
  });

  it('installRuntime should return the public API', () => {
    const api = installRuntime(win);
    expect(api).to.be.an('object');
    expect(api.init).to.be.a('function');
    expect(api.ready).to.be.a('function');
    expect(api.subscribe).to.be.a('function');
  });

  it('installRuntime should be idempotent', () => {
    const api1 = installRuntime(win);
    const api2 = installRuntime(win);
    expect(api1).to.equal(api2);
  });

  it('should support legacy push pattern after installRuntime', async () => {
    const api = installRuntime(win);
    let receivedApi;
    win.SWG = win.SWG || [];
    win.SWG.push((a) => {
      receivedApi = a;
    });
    await tick();
    expect(receivedApi).to.equal(api);
  });

  it('should support ready() promise pattern', async () => {
    const api = installRuntime(win);
    const resolvedApi = await win.SWG.ready();
    expect(resolvedApi).to.equal(api);
  });

  it('should process existing callbacks in SWG array', async () => {
    let receivedApi;
    win.SWG = [
      (a) => {
        receivedApi = a;
      },
    ];
    const api = installRuntime(win);
    await tick();
    expect(receivedApi).to.equal(api);
  });

  it('should suppress auto-start when autoStart is false', () => {
    const api = installRuntime(win, {autoStart: false});
    expect(api).to.be.an('object');
  });
});
