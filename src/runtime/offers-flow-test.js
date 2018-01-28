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

import {ActivityPort} from 'web-activities/activity-ports';
import {ConfiguredRuntime} from './runtime';
import {OffersFlow} from './offers-flow';
import {PageConfig} from '../model/page-config';
import * as sinon from 'sinon';

describes.realWin('Offers flow', {}, env => {
  let win;
  let offersFlow;
  let runtime;
  let activitiesMock;
  let callbacksMock;
  let pageConfig;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig({publicationId: 'pub1', label: 'label1'});
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    callbacksMock = sandbox.mock(runtime.callbacks());
    offersFlow = new OffersFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    callbacksMock.verify();
  });

  it('should have valid OffersFlow constructed', () => {
    const port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        sinon.match.string,
        {publicationId: 'pub1', label: 'label1'})
        .returns(Promise.resolve(port));
    return offersFlow.start();
  });
});
