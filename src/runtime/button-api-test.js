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
import {AnalyticsEvent} from '../proto/api_messages';
import {ButtonApi} from './button-api';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Theme} from './smart-button-api';
import {resolveDoc} from '../model/doc';

function expectOpenIframe(activitiesMock, port, args) {
  activitiesMock
    .expects('openIframe')
    .withExactArgs(
      sandbox.match((arg) => arg.tagName === 'IFRAME'),
      '$frontend$/swg/_/ui/v1/smartboxiframe?_=_',
      args
    )
    .returns(Promise.resolve(port));
}

describes.realWin('ButtonApi', {}, (env) => {
  let win;
  let doc;
  let runtime;
  let pageConfig;
  let port;
  let analyticsMock;
  let activitiesMock;
  let buttonApi;
  let handler;
  let events;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    pageConfig = new PageConfig('pub1:label1', false);
    runtime = new ConfiguredRuntime(win, pageConfig);
    analyticsMock = sandbox.mock(runtime.analytics());
    activitiesMock = sandbox.mock(runtime.activities());
    sandbox
      .stub(ButtonApi.prototype, 'logSwgEvent_')
      .callsFake((eventType, isFromUserAction, params) => {
        events.push({eventType, isFromUserAction, params});
      });
    buttonApi = new ButtonApi(resolveDoc(doc), Promise.resolve(runtime));
    port = new ActivityPort();
    handler = sandbox.spy();
    events = [];
  });

  afterEach(() => {
    activitiesMock.verify();
    analyticsMock.verify();
  });

  describe('init', () => {
    it('should inject stylesheet', () => {
      buttonApi.init();
      const links = doc.querySelectorAll(
        'link[href="$assets$/swg-button.css"]'
      );
      expect(links).to.have.length(1);
      const link = links[0];
      expect(link.getAttribute('rel')).to.equal('stylesheet');
      expect(link.getAttribute('type')).to.equal('text/css');
      expect(link.getAttribute('href')).to.equal('$assets$/swg-button.css');
    });

    it('should inject stylesheet only once', () => {
      new ButtonApi(resolveDoc(doc), Promise.resolve(runtime)).init();
      buttonApi.init();
      const links = doc.querySelectorAll(
        'link[href="$assets$/swg-button.css"]'
      );
      expect(links).to.have.length(1);
    });
  });

  describe('Create and Attach', () => {
    let button;
    let isDarkMode;
    let expectedTitle;

    beforeEach(() => {
      isDarkMode = false;
      expectedTitle = 'Subscribe with Google';
    });

    afterEach(async () => {
      if (isDarkMode) {
        expect(button).to.not.have.class('swg-button-light');
        expect(button).to.have.class('swg-button-dark');
      } else {
        expect(button).to.have.class('swg-button-light');
        expect(button).to.not.have.class('swg-button-dark');
      }

      expect(button.getAttribute('role')).to.equal('button');
      expect(button.getAttribute('title')).to.equal(expectedTitle);
      expect(handler).to.not.be.called;
      await button.click();
      expect(handler).to.be.calledOnce;

      expect(events.length).to.equal(2);
      expect(events[0]).to.deep.equal({
        eventType: AnalyticsEvent.IMPRESSION_SWG_BUTTON,
        isFromUserAction: undefined,
        params: undefined,
      });

      expect(events[1]).to.deep.equal({
        eventType: AnalyticsEvent.ACTION_SWG_BUTTON_CLICK,
        isFromUserAction: true,
        params: undefined,
      });
    });

    it('should create button w/o options', () => {
      button = buttonApi.create(handler);
      expect(button.nodeType).to.equal(1);
      expect(button.tagName).to.equal('BUTTON');
      expect(button.ownerDocument).to.equal(doc);
    });

    it('should attach button w/o options', () => {
      button = doc.createElement('button');
      button.className = 'button1';
      buttonApi.attach(button, handler);
    });

    it('should create button with empty options', () => {
      button = buttonApi.create({}, handler);
    });

    it('should attach button with empty options', () => {
      button = doc.createElement('button');
      button.className = 'button1';
      buttonApi.attach(button, {}, handler);
    });

    it('should create button as light', () => {
      button = buttonApi.create({theme: Theme.LIGHT}, handler);
    });

    it('should attach button as light', () => {
      button = doc.createElement('button');
      button.className = 'button1';
      buttonApi.attach(button, {theme: Theme.LIGHT}, handler);
    });

    it('should create button with options', () => {
      isDarkMode = true;
      button = buttonApi.create({theme: 'dark'}, handler);
    });

    it('should attach button with options', () => {
      button = doc.createElement('button');
      button.className = 'button1';
      buttonApi.attach(button, {theme: Theme.DARK}, handler);
      isDarkMode = true;
      expect(button).to.have.class('button1');
    });

    it('should create button with lang', () => {
      button = buttonApi.create({lang: 'es'}, handler);
      expect(button.lang).to.equal('es');
      expectedTitle = 'Suscríbete con Google';
    });

    it('should attach button with lang', () => {
      button = doc.createElement('button');
      buttonApi.attach(button, {lang: 'es'}, handler);
      expect(button.lang).to.equal('es');
      expectedTitle = 'Suscríbete con Google';
    });

    it('should pick an existing lang', () => {
      button = doc.createElement('button');
      button.setAttribute('lang', 'fr');
      buttonApi.attach(button, {}, handler);
      expect(button.lang).to.equal('fr');
      expectedTitle = "S'abonner avec Google";
    });
  });

  describe('SmartButton', () => {
    let button;
    let args;

    beforeEach(() => {
      button = doc.createElement('button');
      button.className = 'swg-smart-button';
      expect(button.nodeType).to.equal(1);
      args = runtime
        .activities()
        .addDefaultArguments({theme: 'light', lang: 'en'});
    });

    afterEach(async () => {
      expect(handler).to.not.be.called;
      await button.click();
      expect(handler).to.be.calledOnce;
      activitiesMock.verify();
      expect(events.length).to.equal(1);
      expect(events[0]).to.deep.equal({
        eventType: AnalyticsEvent.ACTION_SWG_BUTTON_CLICK,
        isFromUserAction: true,
        params: undefined,
      });
    });

    it('work with no options', () => {
      expectOpenIframe(activitiesMock, port, args);
      buttonApi.attachSmartButton(runtime, button, {}, handler);
    });

    it('work without options parameter', () => {
      expectOpenIframe(activitiesMock, port, args);
      buttonApi.attachSmartButton(runtime, button, handler);
    });

    it('work with options and lang', () => {
      const myArgs = {
        theme: 'dark',
        lang: 'fr',
        messageTextColor: '#411',
      };
      expectOpenIframe(activitiesMock, port, Object.assign(args, myArgs));
      buttonApi.attachSmartButton(runtime, button, myArgs, handler);
    });

    it('work set with default theme when invalid value', () => {
      expectOpenIframe(activitiesMock, port, args);
      buttonApi.attachSmartButton(runtime, button, {theme: 'INVALID'}, handler);
    });
  });
});
