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
import {PageConfigResolver, getControlFlag} from './page-config-resolver';
import {createElement} from '../utils/dom';


describes.realWin('PageConfigResolver', {}, env => {
  let win, doc;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
  });

  function addMeta(name, content) {
    doc.head.appendChild(createElement(doc, 'meta', {name, content}));
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

  it('should default locked to false', () => {
    addMeta('subscriptions-product-id', 'pub1:label1');
    return new PageConfigResolver(win).resolveConfig().then(config => {
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:label1');
    });
  });

  describe('locked', () => {
    it('should parse locked', () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'false');
      return new PageConfigResolver(win).resolveConfig().then(config => {
        expect(config.isLocked()).to.be.true;
        expect(config.getProductId()).to.equal('pub1:label1');
      });
    });

    it('should parse locked in other forms', () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'FALSE');
      return new PageConfigResolver(win).resolveConfig().then(config => {
        expect(config.isLocked()).to.be.true;
        expect(config.getProductId()).to.equal('pub1:label1');
      });
    });

    it('should parse unlocked', () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'true');
      return new PageConfigResolver(win).resolveConfig().then(config => {
        expect(config.isLocked()).to.be.false;
        expect(config.getProductId()).to.equal('pub1:label1');
      });
    });
  });

  describe('control flag', () => {
    it('should parse as null if not found', () => {
      expect(getControlFlag(win)).to.be.null;
    });

    it('should parse from a meta tag', () => {
      addMeta('subscriptions-control', 'auto');
      expect(getControlFlag(win)).to.equal('auto');
    });

    it('should parse from a script tag', () => {
      doc.head.appendChild(createElement(doc, 'script', {
        'subscriptions-control': 'manual',
      }));
      expect(getControlFlag(win)).to.equal('manual');
    });

    it('should prefer meta tag', () => {
      addMeta('subscriptions-control', 'auto');
      doc.head.appendChild(createElement(doc, 'script', {
        'subscriptions-control': 'manual',
      }));
      expect(getControlFlag(win)).to.equal('auto');
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

  it('should configure locked', () => {
    expect(new PageConfig('a:b', true).isLocked()).to.be.true;
    expect(new PageConfig('a:b', false).isLocked()).to.be.false;
  });
});
