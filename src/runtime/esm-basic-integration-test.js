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

import {installBasicRuntime, resetBasicRuntimeForTesting} from './basic-runtime';
import {tick} from '../../test/tick';

describes.realWin('ESM Basic Integration', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
    resetBasicRuntimeForTesting();
  });

  it('installBasicRuntime should return the public API', () => {
    const api = installBasicRuntime(win);
    expect(api).to.be.an('object');
    expect(api.init).to.be.a('function');
    expect(api.setupAndShowAutoPrompt).to.be.a('function');
  });

  it('installBasicRuntime should be idempotent', () => {
    const api1 = installBasicRuntime(win);
    const api2 = installBasicRuntime(win);
    expect(api1).to.equal(api2);
  });

  it('should support legacy push pattern after installBasicRuntime', async () => {
    const api = installBasicRuntime(win);
    let receivedApi;
    win.SWG_BASIC = win.SWG_BASIC || [];
    win.SWG_BASIC.push((a) => {
      receivedApi = a;
    });
    await tick();
    expect(receivedApi).to.equal(api);
  });

  it('should support ready() promise pattern', async () => {
    const api = installBasicRuntime(win);
    const resolvedApi = await win.SWG_BASIC.ready();
    expect(resolvedApi).to.equal(api);
  });

  it('should process existing callbacks in SWG_BASIC array', async () => {
    let receivedApi;
    win.SWG_BASIC = [
      (a) => {
        receivedApi = a;
      },
    ];
    const api = installBasicRuntime(win);
    await tick();
    expect(receivedApi).to.equal(api);
  });

  it('should suppress auto-start when autoStart is false', () => {
    const api = installBasicRuntime(win, {autoStart: false});
    expect(api).to.be.an('object');
  });
});
