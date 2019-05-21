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

import {ActivityPort} from 'web-activities/activity-ports';
import {ButtonApi} from './button-api';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Theme} from './smart-button-api';
import * as sinon from 'sinon';
import {defaultConfig, AnalyticsMode} from '../api/subscriptions';
import {AnalyticsEvent, AnalyticsRequest} from '../proto/api_messages';

describes.realWin('ButtonApi', {}, env => {
  let win;
  let doc;
  let runtime;
  let pageConfig;
  let port;
  let config;
  let activitiesMock;
  let analyticsMock;
  let buttonApi;
  let handler;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    pageConfig = new PageConfig('pub1:label1', false);
    config = defaultConfig();
    runtime = new ConfiguredRuntime(win, pageConfig, config);
    analyticsMock = sandbox.mock(runtime.analytics());
    activitiesMock = sandbox.mock(runtime.activities());
    buttonApi = new ButtonApi(runtime);
    port = new ActivityPort();
    handler = sandbox.spy();
  });

  afterEach(() => {
    activitiesMock.verify();
    analyticsMock.verify();
  });

  it('should inject stylesheet', () => {
    buttonApi.init();
    const links = doc.querySelectorAll('link[href="$assets$/swg-button.css"]');
    expect(links).to.have.length(1);
    const link = links[0];
    expect(link.getAttribute('rel')).to.equal('stylesheet');
    expect(link.getAttribute('type')).to.equal('text/css');
    expect(link.getAttribute('href')).to.equal('$assets$/swg-button.css');
  });

  it('should inject stylesheet only once', () => {
    new ButtonApi(runtime).init();
    buttonApi.init();
    const links = doc.querySelectorAll('link[href="$assets$/swg-button.css"]');
    expect(links).to.have.length(1);
  });

  it('should create button w/o options', () => {
    const button = buttonApi.create(handler);
    expect(button.nodeType).to.equal(1);
    expect(button.tagName).to.equal('BUTTON');
    expect(button.ownerDocument).to.equal(doc);
    expect(button).to.have.class('swg-button-light');  // Default.
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should attach button w/o options', () => {
    const button = doc.createElement('button');
    button.className = 'button1';
    buttonApi.attach(button, handler);
    expect(button).to.have.class('swg-button-light');  // Default.
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should create button with empty options', () => {
    const button = buttonApi.create({}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should create button with options', () => {
    const button = buttonApi.create({theme: 'dark'}, handler);
    expect(button).to.have.class('swg-button-dark');
    expect(button).to.not.have.class('swg-button-light');
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should create button as light', () => {
    const button = buttonApi.create({theme: Theme.LIGHT}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button).to.not.have.class('swg-button-dark');
  });

  it('should create button with lang', () => {
    const button = buttonApi.create({lang: 'es'}, handler);
    expect(button.lang).to.equal('es');
    expect(button.getAttribute('title')).to.equal('Suscríbete con Google');
  });

  it('should attach button with empty options', () => {
    const button = doc.createElement('button');
    button.className = 'button1';
    buttonApi.attach(button, {}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button).to.have.class('button1');
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should attach button with options', () => {
    const button = doc.createElement('button');
    button.className = 'button1';
    buttonApi.attach(button, {theme: Theme.DARK}, handler);
    expect(button).to.have.class('swg-button-dark');
    expect(button).to.not.have.class('swg-button-light');
    expect(button).to.have.class('button1');
    expect(button.getAttribute('role')).to.equal('button');
    expect(button.getAttribute('title')).to.equal('Subscribe with Google');

    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
  });

  it('should attach button as light', () => {
    const button = doc.createElement('button');
    button.className = 'button1';
    buttonApi.attach(button, {theme: Theme.LIGHT}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button).to.not.have.class('swg-button-dark');
    expect(button).to.have.class('button1');
  });

  it('should attach button with lang', () => {
    const button = doc.createElement('button');
    buttonApi.attach(button, {lang: 'es'}, handler);
    expect(button.lang).to.equal('es');
    expect(button.getAttribute('title')).to.equal('Suscríbete con Google');
  });

  it('should pick an existing lang', () => {
    const button = doc.createElement('button');
    button.setAttribute('lang', 'fr');
    buttonApi.attach(button, {}, handler);
    expect(button.lang).to.equal('fr');
    expect(button.getAttribute('title')).to.equal('S\'abonner avec Google');
  });

  it('should attach a smart button with no options', () => {
    const button = doc.createElement('button');
    button.className = 'swg-smart-button';
    expect(button.nodeType).to.equal(1);

    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          theme: 'light',
          lang: 'en',
          analyticsRequest: null,
        })
        .returns(Promise.resolve(port));
    buttonApi.attachSmartButton(button, {}, handler);
    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
    activitiesMock.verify();
  });

  it('should attach a smart button without options parameter', () => {
    const button = doc.createElement('button');
    button.className = 'swg-smart-button';
    expect(button.nodeType).to.equal(1);

    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          theme: 'light',
          lang: 'en',
          analyticsRequest: null,
        })
        .returns(Promise.resolve(port));
    buttonApi.attachSmartButton(button, handler);
    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
    activitiesMock.verify();
  });

  it('should attach a smart button with options and lang', () => {
    const button = doc.createElement('button');
    button.className = 'swg-smart-button';
    expect(button.nodeType).to.equal(1);

    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          theme: 'dark',
          lang: 'fr',
          analyticsRequest: null,
        })
        .returns(Promise.resolve(port));
    buttonApi.attachSmartButton(
        button, {theme: 'dark', lang: 'fr'}, handler);
    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
    activitiesMock.verify();
  });

  it('should attach a smart button with default theme when invalid value',
      () => {
        const button = doc.createElement('button');
        button.className = 'swg-smart-button';
        expect(button.nodeType).to.equal(1);

        activitiesMock.expects('openIframe').withExactArgs(
            sinon.match(arg => arg.tagName == 'IFRAME'),
            '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
            {
              _client: 'SwG $internalRuntimeVersion$',
              publicationId: 'pub1',
              productId: 'pub1:label1',
              theme: 'light',
              lang: 'en',
              analyticsRequest: null,
            })
            .returns(Promise.resolve(port));
        buttonApi.attachSmartButton(
            button, {theme: 'INVALID'}, handler);
        expect(handler).to.not.be.called;
        button.click();
        expect(handler).to.be.calledOnce;
        activitiesMock.verify();
      });

  it('should attach a smart button with analytics enabled', () => {
    const button = doc.createElement('button');
    button.className = 'swg-smart-button';
    expect(button.nodeType).to.equal(1);
    const expAnalyticsRequest = new AnalyticsRequest();
    expAnalyticsRequest.setEvent(AnalyticsEvent.IMPRESSION_SMARTBOX);
    analyticsMock.expects('createLogRequest')
        .withExactArgs(AnalyticsEvent.IMPRESSION_SMARTBOX)
        .returns(expAnalyticsRequest)
        .once();
    config.analyticsMode = AnalyticsMode.IMPRESSIONS;
    runtime.configure(config);
    activitiesMock.expects('openIframe').withExactArgs(
        sinon.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:label1',
          theme: 'light',
          lang: 'en',
          analyticsRequest: expAnalyticsRequest.toArray(),
        })
        .returns(Promise.resolve(port));
    buttonApi.attachSmartButton(button, {}, handler);
    expect(handler).to.not.be.called;
    button.click();
    expect(handler).to.be.calledOnce;
    activitiesMock.verify();
  });
});
