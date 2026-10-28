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

import * as animation from '../utils/animation';
import {ConfiguredRuntime} from '../runtime/runtime';
import {MockActivityPort} from '../../test/mock-activity-port';
import {PageConfig} from '../model/page-config';
import {Toast} from './toast';

const src = 'https://news.google.com/swglib/toastiframe?_=_';

const args = {
  _client: 'SwG 0.0.0',
  publicationId: 'pub1',
  source: 'google',
};

describes.realWin('Toast', (env) => {
  let win;
  let runtime;
  let activitiesMock;
  let clientConfigManagerMock;
  let pageConfig;
  let port;
  let toast;
  let iframe;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:label1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    clientConfigManagerMock = sandbox.mock(runtime.clientConfigManager());
    toast = new Toast(runtime, src, args);
    port = new MockActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    iframe = toast.getElement();

    activitiesMock
      .expects('openIframe')
      .atLeast(1)
      .withExactArgs(
        sandbox.match((arg) => arg.tagName == 'IFRAME'),
        'https://news.google.com/swglib/toastiframe?_=_',
        {
          _client: 'SwG 0.0.0',
          publicationId: 'pub1',
          source: 'google',
        }
      )
      .resolves(port);

    clientConfigManagerMock.expects('getLanguage').atLeast(1).returns('en');
  });

  it('should have created Notification View', async () => {
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

    expect(iframe.getAttribute('title')).to.equal(
      'Subscribe with Google Notification'
    );
  });

  it('should resize iframe when port emits resize request', async () => {
    let resizeCallback;
    port.onResizeRequest = (callback) => {
      resizeCallback = callback;
    };
    port.resized = sandbox.spy();

    let readyResolver;
    port.whenReady = () =>
      new Promise((resolve) => {
        readyResolver = resolve;
      });

    const openPromise = toast.open();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resizeCallback).to.be.a('function');

    resizeCallback(56);
    expect(iframe.style.height).to.equal('56px');
    expect(port.resized).to.have.been.calledOnce;

    readyResolver();
    await openPromise;
    // Sized height should be preserved after whenReady resolves
    expect(iframe.style.height).to.equal('56px');
  });

  it('should automatically close', async () => {
    // Instantly execute setTimeout callbacks for this test.
    win.setTimeout = (callback) => void callback();

    // Toast should add itself to DOM.
    expect(iframe.parentElement).to.not.exist;
    await toast.open();
    expect(iframe.parentElement).to.exist;

    // Toast should remove itself from DOM after all its animations finish.
    await toast.animating_;
    expect(iframe.parentElement).to.not.exist;
  });

  it('should animate desktop publisher toast with translateX', async () => {
    sandbox
      .stub(win, 'matchMedia')
      .withArgs('(min-width: 641px) and (min-height: 641px)')
      .returns({matches: true});
    const transitionSpy = sandbox.spy(animation, 'transition');
    const publisherToast = new Toast(runtime, src, args, 'publisher-toast');

    await publisherToast.open();

    expect(transitionSpy).to.have.been.calledWith(
      publisherToast.getElement(),
      {
        'transform': 'translateX(0)',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );

    await publisherToast.close();

    expect(transitionSpy).to.have.been.calledWith(
      publisherToast.getElement(),
      {
        'transform': 'translateX(calc(100% + 30px))',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );
  });

  it('should animate mobile publisher toast with translateY', async () => {
    sandbox
      .stub(win, 'matchMedia')
      .withArgs('(min-width: 641px) and (min-height: 641px)')
      .returns({matches: false});
    const transitionSpy = sandbox.spy(animation, 'transition');
    const publisherToast = new Toast(runtime, src, args, 'publisher-toast');

    await publisherToast.open();

    expect(transitionSpy).to.have.been.calledWith(
      publisherToast.getElement(),
      {
        'transform': 'translateY(0)',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );

    await publisherToast.close();

    expect(transitionSpy).to.have.been.calledWith(
      publisherToast.getElement(),
      {
        'transform': 'translateY(100%)',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );
  });

  it('should animate standard desktop swg-toast with translateY', async () => {
    sandbox
      .stub(win, 'matchMedia')
      .withArgs('(min-width: 641px) and (min-height: 641px)')
      .returns({matches: true});
    const transitionSpy = sandbox.spy(animation, 'transition');
    const swgToast = new Toast(runtime, src, args, 'swg-toast');

    await swgToast.open();

    expect(transitionSpy).to.have.been.calledWith(
      swgToast.getElement(),
      {
        'transform': 'translateY(0)',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );
  });

  it('should maintain desktop animation axis on close even if window is resized', async () => {
    let isDesktop = true;
    sandbox
      .stub(win, 'matchMedia')
      .withArgs('(min-width: 641px) and (min-height: 641px)')
      .callsFake(() => ({matches: isDesktop}));
    const transitionSpy = sandbox.spy(animation, 'transition');
    const publisherToast = new Toast(runtime, src, args, 'publisher-toast');

    await publisherToast.open();
    // Simulate user resizing window to mobile size while toast is open.
    isDesktop = false;

    await publisherToast.close();

    expect(transitionSpy).to.have.been.calledWith(
      publisherToast.getElement(),
      {
        'transform': 'translateX(calc(100% + 30px))',
        'opacity': '1',
        'visibility': 'visible',
      },
      400,
      'ease-out'
    );
  });
});
