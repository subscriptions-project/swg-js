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

import {ConfiguredRuntime} from './runtime';
import {
  LinkStartFlow,
  LinkCompleteFlow,
} from './link-accounts-flow';
import {PageConfig} from '../model/page-config';


describes.realWin('LinkStartFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let linkAccountsFlow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig({publicationId: 'pub1', label: null});
    runtime = new ConfiguredRuntime(win, pageConfig);
    linkAccountsFlow = new LinkStartFlow(runtime);
  });

  it('should have valid LinkAccountsFlow constructed', () => {
    const linkAccountsPromise = linkAccountsFlow.start();
    expect(linkAccountsPromise).to.eventually.not.be.null;
  });
});


describes.realWin('LinkCompleteFlow', {}, env => {
  let win;
  let pageConfig;
  let runtime;
  let callbacksMock;
  let linkCompleteFlow;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig({publicationId: 'pub1', label: null});
    runtime = new ConfiguredRuntime(win, pageConfig);
    callbacksMock = sandbox.mock(runtime.callbacks());
    linkCompleteFlow = new LinkCompleteFlow(runtime);
  });

  afterEach(() => {
    callbacksMock.verify();
  });

  it('should trigger event', () => {
    callbacksMock.expects('triggerLinkComplete').once();
    linkCompleteFlow.start();
  });
});
