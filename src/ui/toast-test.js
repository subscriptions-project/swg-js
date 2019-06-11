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

import {Toast} from './toast';
import {ActivityPort} from '../components/activities';
import {ConfiguredRuntime} from '../runtime/runtime';
import {PageConfig} from '../model/page-config';
import {getStyle} from '../utils/style';
import * as sinon from 'sinon';

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

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    toast = new Toast(runtime, src, args);
    toast.whenReady = () => Promise.resolve();
    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.onMessageDeprecated = () => {};
    port.whenReady = () => Promise.resolve();
  });

  it('should have created Notification View', function() {
    const iframe = toast.getElement();
    toast.whenReady().then(() => {
      expect(iframe.nodeType).to.equal(1);
      expect(iframe.nodeName).to.equal('IFRAME');

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
      expect(getStyle(iframe, 'display')).to.equal('block');

    // These two properties are not set !important.
      expect(getStyle(iframe, 'width')).to.equal('100%');
      expect(getStyle(iframe, 'left')).to.equal('0px');
    });
  });

  it('should build the content of toast iframe', function* () {
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swglib/toastiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          source: 'google',
        })
        .returns(Promise.resolve(port));
    return toast.open();
  });
});
