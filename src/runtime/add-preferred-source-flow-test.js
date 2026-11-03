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

import {ActivityIframePort} from '../components/activities';
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
  let pageConfig;
  let runtime;
  let activitiesMock;
  let dialogManagerMock;
  let port;
  let flow;
  let clientConfigManager;
  let clientConfigManagerMock;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1', true);
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    port = sandbox.createStubInstance(ActivityIframePort);
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    port.acceptResult = () =>
      Promise.resolve({
        data: [
          'AddPreferredSourceResponse',
          AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
          'WELT',
        ],
        origin: 'https://news.google.com',
        originVerified: true,
        secureChannel: true,
      });

    clientConfigManager = new ClientConfigManager(runtime);
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(runtime, 'clientConfigManager').returns(clientConfigManager);

    flow = new AddPreferredSourceFlow(runtime);
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
    clientConfigManagerMock.verify();
  });

  it('starts flow in popup window with language parameter without registering duplicate onResult', async () => {
    activitiesMock.expects('onResult').never();
    activitiesMock
      .expects('openPopupWithMessaging')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match(
          (url) => url.includes('/addpreferredsource') && url.includes('hl=en')
        ),
        '_blank',
        sandbox.match.object,
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

  it('passes window location href in source URL query param', async () => {
    activitiesMock.expects('onResult').never();
    activitiesMock
      .expects('openPopupWithMessaging')
      .withExactArgs(
        'addPreferredSource',
        sandbox.match(
          (url) =>
            url.includes('/addpreferredsource') && url.includes('source=')
        ),
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
    let onCancelOrError;

    beforeEach(() => {
      onResponse = sandbox.spy();
      onCancelOrError = sandbox.spy();
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

      AddPreferredSourceFlow.configurePending(
        runtime,
        onResponse,
        onCancelOrError
      );
    });

    it('delivers parsed AddPreferredSourceResponse from verified popup port', async () => {
      onResultCallback(port);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const expected = new AddPreferredSourceResponse([
        'AddPreferredSourceResponse',
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_SUCCESS,
        'WELT',
      ]);
      expect(onResponse).to.have.been.calledOnceWithExactly(expected);
      expect(onCancelOrError).to.not.have.been.called;
    });

    it('delivers parsed AddPreferredSourceResponse from verified redirect port', async () => {
      port.acceptResult = () =>
        Promise.resolve({
          data: [
            'AddPreferredSourceResponse',
            AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED,
            'WELT',
          ],
          origin: 'https://news.google.com',
          originVerified: true,
          secureChannel: false,
        });

      onResultCallback(port);
      await new Promise((resolve) => setTimeout(resolve, 0));

      const expected = new AddPreferredSourceResponse([
        'AddPreferredSourceResponse',
        AddPreferredSourceStatus.ADD_PREFERRED_SOURCE_STATUS_ALREADY_ADDED,
        'WELT',
      ]);
      expect(onResponse).to.have.been.calledOnceWithExactly(expected);
      expect(onCancelOrError).to.not.have.been.called;
    });

    it('calls onCancelOrError when originVerified is false', async () => {
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

      onResultCallback(port);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onResponse).to.not.have.been.called;
      expect(onCancelOrError).to.have.been.calledOnce;
    });

    it('calls onCancelOrError when result data is null or non-array', async () => {
      port.acceptResult = () =>
        Promise.resolve({
          data: null,
          origin: 'https://news.google.com',
          originVerified: true,
          secureChannel: false,
        });

      onResultCallback(port);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onResponse).to.not.have.been.called;
      expect(onCancelOrError).to.have.been.calledOnce;
    });

    it('calls onCancelOrError when acceptResult rejects on cancellation', async () => {
      port.acceptResult = () =>
        Promise.reject(new DOMException('AbortError', 'AbortError'));

      onResultCallback(port);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(onResponse).to.not.have.been.called;
      expect(onCancelOrError).to.have.been.calledOnce;
    });
  });
});
