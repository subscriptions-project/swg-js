/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityPort} from '../components/activities';
import {ConfiguredRuntime} from '../runtime/runtime';
import {PageConfig} from '../model/page-config';
import {Toast} from './toast';

const src = '$frontend$/swglib/toastiframe?_=_';

const args = {
  _client: 'SwG $internalRuntimeVersion$',
  publicationId: 'pub1',
  source: 'google',
};

describes.realWin('Toast', {}, env => {
  let win;
  let runtime;
  let activitiesMock;
  let pageConfig;
  let port;
  let toast;
  let iframe;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    toast = new Toast(runtime, src, args);
    toast.whenReady = () => Promise.resolve();
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    iframe = toast.getElement();

    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swglib/toastiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          source: 'google',
        }
      )
      .returns(Promise.resolve(port));
  });

  it('should have created Notification View', async () => {
    await toast.whenReady();
    expect(iframe.nodeType).to.equal(1);
    expect(iframe.nodeName).to.equal('IFRAME');
  });

  it('should build the content of toast iframe', async () => {
    await toast.open();
    const iframeStyles = getComputedStyle(iframe);
    expect(iframeStyles.opacity).to.equal('1');
    expect(iframeStyles.bottom).to.equal('0px');
    expect(iframeStyles.display).to.equal('block');

    // These two properties are not set !important.
    expect(iframeStyles.width).to.equal('300px');
    expect(iframeStyles.left).to.equal('0px');
  });
});
