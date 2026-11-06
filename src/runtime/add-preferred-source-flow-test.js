/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {AddPreferredSourceFlow} from './add-preferred-source-flow';
import {
  AddPreferredSourceResponse,
  AddPreferredSourceStatus,
} from '../proto/api_messages';
import {ClientConfigManager} from './client-config-manager';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';

describes.realWin('AddPreferredSourceFlow', (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let clientConfigManager;
  let flow;

  beforeEach(() => {
    win = env.win;
    runtime = new ConfiguredRuntime(win, new PageConfig('pub1:label1', true));
    activitiesMock = sandbox.mock(runtime.activities());
    clientConfigManager = new ClientConfigManager(runtime);
    sandbox.stub(runtime, 'clientConfigManager').returns(clientConfigManager);
    flow = new AddPreferredSourceFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
  });

  it('starts flow in popup window with default language and source URL without registering duplicate onResult', async () => {
    const encodedSource = encodeURIComponent(win.location.href);
    activitiesMock.expects('onResult').never();
    activitiesMock
      .expects('openPopupWithMessaging')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match(
          (url) =>
            url.includes('/addpreferredsource') &&
            url.includes('hl=en') &&
            url.includes(`source=${encodedSource}`)
        ),
        '_blank',
        sandbox.match({source: win.location.href}),
        sandbox.match.object
      )
      .once()
      .resolves();

    await flow.start();
  });

  it('prefers explicit options.language over clientConfigManager', async () => {
    const customFlow = new AddPreferredSourceFlow(runtime, {language: 'de'});
    activitiesMock.expects('onResult').never();
    activitiesMock
      .expects('openPopupWithMessaging')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match((url) => url.includes('hl=de')),
        '_blank',
        sandbox.match.object,
        sandbox.match.object
      )
      .once()
      .resolves();

    await customFlow.start();
  });

  it('passes custom language from clientConfigManager', async () => {
    sandbox.stub(clientConfigManager, 'getLanguage').returns('fr-FR');
    activitiesMock.expects('onResult').never();
    activitiesMock
      .expects('openPopupWithMessaging')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match((url) => url.includes('hl=fr-FR')),
        '_blank',
        sandbox.match.object,
        sandbox.match.object
      )
      .once()
      .resolves();

    await flow.start();
  });

  describe('configurePending', () => {
    let onResultCallback;
    let onResponse;
    let port;

    beforeEach(() => {
      onResponse = sandbox.spy();
      port = {
        acceptResult: () =>
          Promise.resolve({
            data: [
              'AddPreferredSourceResponse',
              AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
              'TestSite',
            ],
            origin: 'https://news.google.com',
            originVerified: true,
            secureChannel: true,
          }),
      };
      activitiesMock
        .expects('onResult')
        .withExactArgs(
          'addPreferredSource',
          sandbox.match((arg) => {
            onResultCallback = arg;
            return typeof arg === 'function';
          })
        )
        .once();

      AddPreferredSourceFlow.configurePending(runtime, onResponse);
    });

    it('delivers parsed AddPreferredSourceResponse from verified popup port', async () => {
      await onResultCallback(port);

      const expected = new AddPreferredSourceResponse([
        'AddPreferredSourceResponse',
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
        'TestSite',
      ]);
      expect(onResponse).to.have.been.calledOnceWithExactly(expected);
    });

    it('delivers parsed AddPreferredSourceResponse from verified redirect port', async () => {
      port.acceptResult = () =>
        Promise.resolve({
          data: [
            'AddPreferredSourceResponse',
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED,
            'TestSite',
          ],
          origin: 'https://news.google.com',
          originVerified: true,
          secureChannel: false,
        });

      await onResultCallback(port);

      const expected = new AddPreferredSourceResponse([
        'AddPreferredSourceResponse',
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED,
        'TestSite',
      ]);
      expect(onResponse).to.have.been.calledOnceWithExactly(expected);
    });

    it('ignores result when originVerified is false', async () => {
      port.acceptResult = () =>
        Promise.resolve({
          data: [
            'AddPreferredSourceResponse',
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
            'Spoof',
          ],
          origin: 'https://news.google.com',
          originVerified: false,
          secureChannel: false,
        });

      await onResultCallback(port);

      expect(onResponse).to.not.have.been.called;
    });

    it('ignores result when data is null or non-array', async () => {
      port.acceptResult = () =>
        Promise.resolve({
          data: null,
          origin: 'https://news.google.com',
          originVerified: true,
          secureChannel: false,
        });

      await onResultCallback(port);

      expect(onResponse).to.not.have.been.called;
    });

    it('ignores result when acceptResult rejects on cancellation', async () => {
      port.acceptResult = () =>
        Promise.reject(new DOMException('AbortError', 'AbortError'));

      await onResultCallback(port);

      expect(onResponse).to.not.have.been.called;
    });
  });
});
