/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {SubscriptionMarkup} from './subscription-markup';


describes.realWin('markup', {}, env => {
  let win;
  let meta, meta2;
  let subMarkup;

  beforeEach(() => {
    win = env.win;
    meta = win.document.createElement('meta');
    meta2 = win.document.createElement('meta');
    win.document.head.appendChild(meta);
    win.document.head.appendChild(meta2);
    subMarkup = new SubscriptionMarkup(win);
  });

  afterEach(() => {
    win.document.head.removeChild(meta);
    win.document.head.removeChild(meta2);
  });

  it('should return access type', () => {
    meta.setAttribute('content', 'foo1');
    meta.setAttribute('name', 'access-type');
    expect(subMarkup.getAccessType()).to.equal('foo1');
  });

  it('should return access content', () => {
    meta.setAttribute('content', 'foo2');
    meta.setAttribute('name', 'access-content');
    expect(subMarkup.getAccessContent()).to.equal('foo2');
  });

  it('should return access control', () => {
    meta.setAttribute('content', 'foo3');
    meta.setAttribute('name', 'access-control');
    expect(subMarkup.getAccessControl()).to.equal('foo3');
  });

  it('should return empty string when the values are not found', () => {
    expect(subMarkup.getAccessType()).to.equal('');
    expect(subMarkup.getAccessContent()).to.equal('');
    expect(subMarkup.getAccessControl()).to.equal('');
  });

  it('should return access-type and access-control when both are set', () => {
    meta.setAttribute('content', 'foo4');
    meta.setAttribute('name', 'access-content');

    meta2.setAttribute('content', 'foo5');
    meta2.setAttribute('name', 'access-type');

    expect(subMarkup.getAccessType()).to.equal('foo5');
    expect(subMarkup.getAccessContent()).to.equal('foo4');
  });

  it('returns first value when multiple values are found', () => {
    meta.setAttribute('content', 'foo6');
    meta.setAttribute('name', 'access-content');

    meta2.setAttribute('content', 'foo7');
    meta2.setAttribute('name', 'access-content');

    expect(subMarkup.getAccessContent()).to.equal('foo6');
  });

  it('does not return a value if the document is modified later', () => {
    expect(subMarkup.getAccessContent()).to.equal('');
    meta.setAttribute('content', 'foo6');
    meta.setAttribute('name', 'access-content');

    expect(subMarkup.getAccessContent()).to.equal('');
  });

  it('should return theme color', () => {
    meta.setAttribute('content', '#eee');
    meta.setAttribute('name', 'theme-color');
    expect(subMarkup.getThemeColor()).to.equal('#eee');
  });
});
