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

import {ButtonApi} from './button-api';
import {resolveDoc} from '../model/doc';


describes.realWin('ButtonApi', {}, env => {
  let doc;
  let buttonApi;
  let handler;

  beforeEach(() => {
    doc = env.win.document;
    buttonApi = new ButtonApi(resolveDoc(doc));
    handler = sandbox.spy();
  });

  it('should inject stylesheet', () => {
    buttonApi.init();
    const links = doc.querySelectorAll(
        'link[href="https://news.google.com/swg/js/v1/swg-button.css"]');
    expect(links).to.have.length(1);
    const link = links[0];
    expect(link.getAttribute('rel')).to.equal('stylesheet');
    expect(link.getAttribute('type')).to.equal('text/css');
    expect(link.getAttribute('href'))
        .to.equal('https://news.google.com/swg/js/v1/swg-button.css');
  });

  it('should inject stylesheet only once', () => {
    new ButtonApi(resolveDoc(doc)).init();
    buttonApi.init();
    const links = doc.querySelectorAll(
        'link[href="https://news.google.com/swg/js/v1/swg-button.css"]');
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
    const button = buttonApi.create({theme: 'light'}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button).to.not.have.class('swg-button-dark');
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
    buttonApi.attach(button, {theme: 'dark'}, handler);
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
    buttonApi.attach(button, {theme: 'light'}, handler);
    expect(button).to.have.class('swg-button-light');
    expect(button).to.not.have.class('swg-button-dark');
    expect(button).to.have.class('button1');
  });
});
