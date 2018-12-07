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

import {AnalyticsContext, deserialize} from '../proto/api_messages';
import {ActivityIframePort} from 'web-activities/activity-ports';
import {ConfiguredRuntime} from '../runtime/runtime';
import {PageConfig} from '../model/page-config';
import {feUrl} from '../runtime/services';
import {createElement} from '../utils/dom';
import {setExperimentsStringForTesting} from '../runtime/experiments';
import {ActivityClientInterface} from './activity-client-interface';

describes.realWin('ActivityClientInterface', {}, env => {
  let win;
  let src;
  let iframe;
  let pageConfig;
  let messageCallback;
  let runtime;
  const productId = 'pub1:label1';

  beforeEach(() => {
    win = env.win;
    src = '/testiframe';
    pageConfig = new PageConfig(productId);
    runtime = new ConfiguredRuntime(win, pageConfig);
    iframe = /** @type {!HTMLIFrameElement} */ (createElement(
        win.document, 'iframe', {}));
    activityClientInterface = new ActivityClientInterface(
        iframe, feUrl(src), runtime.activities());
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  describe('ActivityClientInterface', () => {
    it('should start ActivityClientInterface', () => {
      const /* AnalyticsContext */ context = new AnalyticsContext();
      let callArgs = undefined;
      sandbox.stub(ActivityIframePort.prototype, 'message', data => {
          callArgs = data;
      });
      activityClientInterface.start(pageConfig.getPublicationId(), context);
      expect(callArgs).to.deep.equal({'pubId': 'pub1', 'context': context.toArray()});
    });

    it('should execute ActivityClientInterface', () => {
      const /* AnalyticsContext */ context = new AnalyticsContext();
      let callArgs = undefined;
      sandbox.stub(ActivityIframePort.prototype, 'message', data => {
        callArgs = data;
      });
      activityClientInterface.execute(context.toArray());
      expect(callArgs).to.deep.equal({'req': context.toArray()});
    });

    it('should invoke on ActivityClientInterface', () => {
      sandbox.stub(ActivityIframePort.prototype, 'onMessage', cb => {
          messageCallback = cb;
      });
      activityClientInterface.on('AnalyticsContext', context => {
          const /* AnalyticsContext */ ctxt = deserialize(context);
          expect(ctxt).to.not.be.null;
      });
      const /* AnalyticsContext */ testContext = new AnalyticsContext();
      messageCallback(testContext.toArray());
    });
  });
});
