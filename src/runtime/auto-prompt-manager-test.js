/**
 * Copyright 2021 The Subscribe with Google Authors. All Rights Reserved.
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

import {AutoPromptConfig} from '../model/auto-prompt-config';
import {AutoPromptManager} from './auto-prompt-manager';
import {AutoPromptType} from '../api/basic-subscriptions';
import {ClientConfigManager} from './client-config-manager';
import {ClientEventManager} from './client-event-manager';
import {DepsDef} from './deps';
import {Entitlements} from '../api/entitlements';
import {EntitlementsManager} from './entitlements-manager';
import {Fetcher} from './fetcher';
import {PageConfig} from '../model/page-config';
import {Storage} from './storage';

describes.realWin('AutoPromptManager', {}, (env) => {
  let autoPromptManager;
  let win;
  let deps;
  let pageConfig;
  let fetcher;
  let eventManager;
  let entitlementsManager;
  let entitlementsManagerMock;
  let clientConfigManager;
  let clientConfigManagerMock;
  let alternatePromptSpy;
  const productId = 'pub1:label1';
  const pubId = 'pub1';

  beforeEach(() => {
    deps = new DepsDef();

    win = env.win;

    pageConfig = new PageConfig(productId);
    sandbox.stub(deps, 'pageConfig').returns(pageConfig);

    eventManager = new ClientEventManager(Promise.resolve());
    sandbox.stub(deps, 'eventManager').returns(eventManager);

    const storage = new Storage(win);
    sandbox.stub(deps, 'storage').returns(storage);

    fetcher = new Fetcher(win);
    entitlementsManager = new EntitlementsManager(
      win,
      pageConfig,
      fetcher,
      deps
    );
    entitlementsManagerMock = sandbox.mock(entitlementsManager);
    sandbox.stub(deps, 'entitlementsManager').returns(entitlementsManager);

    clientConfigManager = new ClientConfigManager(pubId, fetcher);
    clientConfigManagerMock = sandbox.mock(clientConfigManager);
    sandbox.stub(deps, 'clientConfigManager').returns(clientConfigManager);

    autoPromptManager = new AutoPromptManager(deps);

    alternatePromptSpy = sandbox.spy();
  });

  afterEach(() => {
    entitlementsManagerMock.verify();
    clientConfigManagerMock.verify();
  });

  it('should display the contribution mini prompt if the user has no entitlements', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(1);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is displayed when implemented.
  });

  it('should display the mini prompt, but not fetch entitlements and client config if alwaysShow is enabled', async () => {
    entitlementsManagerMock.expects('getEntitlements').never();
    clientConfigManagerMock.expects('getAutoPromptConfig').never();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: true},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is displayed when implemented.
  });

  it('should not display any prompt if the type is undefined', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(1);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: undefined, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is not displayed when implemented.
  });

  it('should not display any prompt if the type is NONE', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(1);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.NONE, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is not displayed when implemented.
  });

  it('should not display any prompt if the auto prompt config is not returned', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve())
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is not displayed when implemented.
  });

  it('should display the mini prompt if the auto prompt config does not cap impressions', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig();
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is displayed when implemented.
  });

  it('should display the subscription mini prompt if the user has no entitlements', async () => {
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(0);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.SUBSCRIPTION, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is displayed when implemented.
  });

  it('should not display any prompt if the user has a valid entitlements', async () => {
    const entitlements = new Entitlements();
    sandbox.stub(entitlements, 'enablesThis').returns(true);
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(1);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: false},
      alternatePromptSpy
    );
    expect(alternatePromptSpy).to.not.be.called;
    // TODO(stellachui): Verify mini prompt is not displayed when implemented.
  });

  it('should display the alternate prompt if the user has no entitlements, but the content is paygated', async () => {
    sandbox.stub(pageConfig, 'isLocked').returns(true);
    const entitlements = new Entitlements();
    entitlementsManagerMock
      .expects('getEntitlements')
      .returns(Promise.resolve(entitlements))
      .once();
    const autoPromptConfig = new AutoPromptConfig(1);
    clientConfigManagerMock
      .expects('getAutoPromptConfig')
      .returns(Promise.resolve(autoPromptConfig))
      .once();

    await autoPromptManager.showAutoPrompt(
      {autoPromptType: AutoPromptType.CONTRIBUTION, alwaysShow: false},
      alternatePromptSpy
    );

    expect(alternatePromptSpy).to.be.calledOnce;
    // TODO(stellachui): Verify mini prompt is not displayed when implemented.
  });
});
