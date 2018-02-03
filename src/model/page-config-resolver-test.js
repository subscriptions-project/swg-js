/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {PageConfig} from './page-config';
import {PageConfigResolver} from './page-config-resolver';


describes.realWin('PageConfigResolver', {}, env => {
  let win, doc;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
  });

  function addMeta(name, content) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', name);
    meta.setAttribute('content', content);
    doc.head.appendChild(meta);
  }

  it('should parse publisher id and product', () => {
    addMeta('subscriptions-product-id', 'pub1:label1');
    return new PageConfigResolver(win).resolveConfig().then(config => {
      expect(config.getProductId()).to.equal('pub1:label1');
      expect(config.getPublisherId()).to.equal('pub1');
      expect(config.getLabel()).to.equal('label1');
    });
  });

  it('should parse publisher id and null product', () => {
    addMeta('subscriptions-product-id', 'pub1');
    return new PageConfigResolver(win).resolveConfig().then(config => {
      expect(config.getPublisherId()).to.equal('pub1');
      expect(config.getProductId()).to.be.null;
      expect(config.getLabel()).to.be.null;
    });
  });
});


describes.sandboxed('PageConfig', {}, () => {
  it('should create from product id', () => {
    const config = new PageConfig('a.b.c.pub1:d.e.f');
    expect(config.getPublisherId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.equal('a.b.c.pub1:d.e.f');
    expect(config.getLabel()).to.equal('d.e.f');
  });

  it('should create from publisher id', () => {
    const config = new PageConfig('a.b.c.pub1');
    expect(config.getPublisherId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.be.null;
    expect(config.getLabel()).to.be.null;
  });

  it('should tolerate unusual labels', () => {
    const config = new PageConfig('a.b.c.pub1:d:e.f');
    expect(config.getPublisherId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.equal('a.b.c.pub1:d:e.f');
    expect(config.getLabel()).to.equal('d:e.f');
  });
});
