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

import {GlobalDoc} from './doc';
import {PageConfig} from './page-config';
import {PageConfigResolver, getControlFlag} from './page-config-resolver';
import {createElement} from '../utils/dom';

describes.realWin('PageConfigResolver', {}, (env) => {
  let win, doc, gd;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    gd = new GlobalDoc(win);
  });

  function addMeta(name, content) {
    doc.head.appendChild(createElement(doc, 'meta', {name, content}));
  }

  function addJsonLd(content) {
    const element = createElement(
      doc,
      'script',
      {
        type: 'application/ld+json',
      },
      JSON.stringify(content)
    );
    doc.body.appendChild(element);
    return element;
  }

  function addMicrodata(content) {
    doc.body.appendChild(content);
  }

  describe('parse meta', () => {
    it('should parse publication id and product', async () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.getProductId()).to.equal('pub1:label1');
      expect(config.getPublicationId()).to.equal('pub1');
      expect(config.getLabel()).to.equal('label1');
    });

    it('should parse publication id and null product', async () => {
      addMeta('subscriptions-product-id', 'pub1');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.getPublicationId()).to.equal('pub1');
      expect(config.getProductId()).to.be.null;
      expect(config.getLabel()).to.be.null;
    });

    it('should default locked to false', async () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:label1');
    });
  });

  describe('parse json-ld', () => {
    let schema;
    let readyState;

    beforeEach(() => {
      schema = {
        '@context': 'http://schema.org',
        '@type': 'NewsArticle',
        'isAccessibleForFree': 'False',
        'isPartOf': {
          '@type': ['CreativeWork', 'Product'],
          'name': 'The Times Journal',
          'productID': 'pub1:basic',
        },
      };
      readyState = 'loading';
      Object.defineProperty(doc, 'readyState', {get: () => readyState});
    });

    it('should discover parse properties from schema', async () => {
      addJsonLd(schema);
      readyState = 'complete';
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:basic');
    });

    it('should wait until the element is ready (not empty)', async () => {
      const resolver = new PageConfigResolver(gd);
      const element = createElement(doc, 'script', {
        type: 'application/ld+json',
      });
      doc.body.appendChild(element);
      doc.body.appendChild(createElement(doc, 'div')); // Next element.

      // Empty content.
      let config = resolver.check();
      expect(config).to.be.null;

      // Add content.
      element.textContent = JSON.stringify(schema);
      config = resolver.check();
      expect(config).to.be.ok;
      expect(config.getProductId()).to.equal('pub1:basic');
      await expect(resolver.resolveConfig()).to.eventually.equal(config);
    });

    it('should wait until the element is ready (next sibling)', async () => {
      const resolver = new PageConfigResolver(gd);
      addJsonLd(schema);

      // No siblings.
      let config = resolver.check();
      expect(config).to.be.null;

      // Add a sibling.
      doc.body.appendChild(createElement(doc, 'div')); // Next element.
      config = resolver.check();
      expect(config).to.be.ok;
      expect(config.getProductId()).to.equal('pub1:basic');
      await expect(resolver.resolveConfig()).to.eventually.equal(config);
    });

    it('should wait until the element is ready (dom ready)', async () => {
      const resolver = new PageConfigResolver(gd);
      addJsonLd(schema);

      // Document not complete and no siblings.
      let config = resolver.check();
      expect(config).to.be.null;

      // Complete document.
      readyState = 'complete';
      config = resolver.check();
      expect(config).to.be.ok;
      expect(config.getProductId()).to.equal('pub1:basic');
      await expect(resolver.resolveConfig()).to.eventually.equal(config);
    });

    it('should ignore wrong script type', () => {
      doc.body.appendChild(
        createElement(
          doc,
          'script',
          {
            type: 'application/json', // Not LD.
          },
          JSON.stringify(schema)
        )
      );
      readyState = 'complete';
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });

    it('should ignore wrong LD type', () => {
      schema['@type'] = 'Other';
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check()).to.be.null;
    });

    it('should allow array for LD type', () => {
      schema['@type'] = ['NewsArticle'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should allow alternate LD Types', () => {
      schema['@type'] = ['CreativeWork'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should work with multiple LD types', () => {
      schema['@type'] = ['NewsArticle', 'Person'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should return null with multiple LD types when none match', () => {
      schema['@type'] = ['Place', 'Person'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check()).to.be.null;
    });

    it('should allow full namespace for LD type', () => {
      schema['@type'] = ['http://schema.org/NewsArticle'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should tolerate broken JSON', () => {
      const element = createElement(
        doc,
        'script',
        {
          type: 'application/ld+json',
        },
        '{NewsArticle'
      );
      doc.body.appendChild(element);
      readyState = 'complete';

      // Doesn't fail.
      expect(new PageConfigResolver(gd).check()).to.be.null;
    });

    it('should allow array of products', () => {
      schema['isPartOf'] = [{}, schema['isPartOf']];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should allow array of product types', () => {
      schema['isPartOf']['@type'] = ['CreativeWork', 'Product'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should ignore wrong product type', () => {
      schema['isPartOf']['@type'] = ['CreativeWork', 'Other'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check()).to.be.null;
    });

    it('should allow array of product IDs', () => {
      schema['isPartOf']['productID'] = ['pub1:l1', 'pub1:l2'];
      addJsonLd(schema);
      readyState = 'complete';
      // First one is picked.
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:l1'
      );
    });

    it('should accept false string for isAccessibleForFree', () => {
      schema['isAccessibleForFree'] = 'FaLsE';
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.true;
    });

    it('should accept true string for isAccessibleForFree', () => {
      schema['isAccessibleForFree'] = 'TRuE';
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.false;
    });

    it('should accept false bool for isAccessibleForFree', () => {
      schema['isAccessibleForFree'] = false;
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.true;
    });

    it('should accept true bool for isAccessibleForFree', () => {
      schema['isAccessibleForFree'] = true;
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.false;
    });

    it('should default isAccessibleForFree to unlocked', () => {
      delete schema['isAccessibleForFree'];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.false;
    });

    it('should accept array for isAccessibleForFree', () => {
      schema['isAccessibleForFree'] = [false, true];
      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().isLocked()).to.be.true;
    });

    it('should handle top level array of objects', () => {
      const productId = 'pub1:basic';

      schema = [
        {
          '@context': 'http://schema.org',
          '@type': 'ImageObject',
          'contentUrl': 'testurl.com/',
          'name': 'Test Image',
        },
        {
          '@context': 'http://schema.org',
          '@type': 'NewsArticle',
          'isAccessibleForFree': 'False',
          'isPartOf': {
            '@type': ['CreativeWork', 'Product'],
            'name': 'The Times Journal',
            'productID': productId,
          },
        },
      ];

      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        productId
      );
    });

    it('should handle a graph of objects', () => {
      schema = {
        '@graph': [
          {
            '@context': 'http://schema.org',
            '@type': 'NewsArticle',
            'isAccessibleForFree': 'False',
            'isPartOf': {
              '@type': ['CreativeWork', 'Product'],
              'name': 'The Times Journal',
              'productID': 'pub1:basic',
            },
          },
          {
            '@context': 'http://schema.org',
            '@type': 'NewsArticle',
            'isAccessibleForFree': 'False',
            'isPartOf': {
              '@type': ['CreativeWork', 'Product'],
              'name': 'The Times Journal',
              'productID': 'pub1:plus',
            },
          },
        ],
      };

      addJsonLd(schema);
      readyState = 'complete';
      expect(new PageConfigResolver(gd).check().getProductId()).to.equal(
        'pub1:basic'
      );
    });

    it('should ignore a malformed graph', () => {
      schema = {
        '@graph': {
          '@context': 'http://schema.org',
          '@type': 'NewsArticle',
          'isAccessibleForFree': 'False',
          'isPartOf': {
            '@type': ['CreativeWork', 'Product'],
            'name': 'The Times Journal',
            'productID': 'pub1:basic',
          },
        },
      };

      addJsonLd(schema);
      readyState = 'complete';
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });
  });

  describe('parse microdata', () => {
    let readyState;

    beforeEach(() => {
      readyState = 'loading';
      Object.defineProperty(doc, 'readyState', {get: () => readyState});
    });

    it('should handle multiple item types', async () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML =
        '<div itemscope itemtype="http://schema.org/NewsArticle http://schema.org/Other"> \
            <meta itemprop="isAccessibleForFree" content="True"/> \
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product"> \
              <meta itemprop="name" content="New York Times"/> \
              <meta itemprop="productID" content="pub1:premium"/> \
            </div> \
            <div itemprop="articleBody" class="paywalled-section"> \
              Paid content possibly. \
            </div> \
          </div>';
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      const config = await resolver.resolveConfig();
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:premium');
    });

    it('should retur null for multiple invalid types', () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML =
        '<div itemscope itemtype="http://schema.org/Person http://schema.org/Other"> \
            <meta itemprop="isAccessibleForFree" content="True"/> \
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product"> \
              <meta itemprop="name" content="New York Times"/> \
              <meta itemprop="productID" content="pub1:premium"/> \
            </div> \
            <div itemprop="articleBody" class="paywalled-section"> \
              Paid content possibly. \
            </div> \
          </div>';
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });

    it('should handle alternate item types', async () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML =
        '<div itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Other"> \
            <meta itemprop="isAccessibleForFree" content="True"/> \
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product"> \
              <meta itemprop="name" content="New York Times"/> \
              <meta itemprop="productID" content="pub1:premium"/> \
            </div> \
            <div itemprop="articleBody" class="paywalled-section"> \
              Paid content possibly. \
            </div> \
          </div>';
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      const config = await resolver.resolveConfig();
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:premium');
    });

    it('should parse unlocked access when available', async () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML =
        '<div itemscope itemtype="http://schema.org/NewsArticle"> \
            <meta itemprop="isAccessibleForFree" content="True"/> \
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product"> \
              <meta itemprop="name" content="New York Times"/> \
              <meta itemprop="productID" content="pub1:premium"/> \
            </div> \
            <div itemprop="articleBody" class="paywalled-section"> \
              Paid content possibly. \
            </div> \
          </div>';
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      const config = await resolver.resolveConfig();
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:premium');
    });

    it('should not default unlocked access when dom is not ready', async () => {
      const resolver = new PageConfigResolver(gd);
      const divElement = createElement(doc, 'div');
      divElement.innerHTML =
        '<div itemscope itemtype="http://schema.org/NewsArticle" id="top"> \
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product"> \
            <meta itemprop="name" content="New York Times"/> \
            <meta itemprop="productID" content="pub1:premium"/> \
          </div> \
          <div itemprop="hasPart" itemscope itemtype="http://schema.org/WebPageElement"> \
            <meta itemprop="isAccessibleForFree" content="true"> \
            <meta itemprop="cssSelector" content=".paywalled-section"/> \
          </div> \
          <div itemprop="articleBody" class="paywalled-section"> \
            Paid content possibly. \
          </div> \
        </div>';
      addMicrodata(divElement);
      readyState = 'loading';
      // Empty content.
      let config = resolver.check();
      expect(config).to.be.null;

      // Add content.
      const validAccessElement = createElement(doc, 'div');
      validAccessElement.innerHTML = `<div id="bottom">
            <meta itemprop="isAccessibleForFree" content="false"/>
            <meta itemprop="cssSelector" content=".paywalled-section"/>
          </div>`;
      doc.getElementById('top').appendChild(validAccessElement);
      config = resolver.check();
      readyState = 'complete';
      expect(config).to.be.ok;
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:premium');
      await expect(resolver.resolveConfig()).to.eventually.equal(config);
    });

    it('malformed microdata no productId', () => {
      // Add content.
      const divElement = createElement(doc, 'div');
      divElement.innerHTML = `<div itemscope itemtype="http://schema.org/NewsArticle">
            <div itemprop="hasPart" itemscope itemtype="http://schema.org/WebPageElement">
              <meta itemprop="isAccessibleForFree" content=true/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div itemprop="articleBody" class="paywalled-section">
              Paid content possibly.
            </div>
          </div>`;
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });

    it('malformed microdata not news article type', () => {
      // Add content.
      const divElement = createElement(doc, 'div');
      divElement.innerHTML = `<div>
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
              <meta itemprop="name" content="New York Times"/>
              <meta itemprop="productID" content="pub1:premium"/>
            </div>
            <div itemprop="hasPart" itemscope itemtype="http://schema.org/WebPageElement">
              <meta itemprop="isAccessibleForFree" content=true/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div itemprop="articleBody" class="paywalled-section">
              Paid content possibly.
            </div>
          </div>`;
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });

    it('malformed microdata tree product info under section type', () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML = `<div itemscope itemtype="http://schema.org/NewsArticle">
          <div itemscope itemtype="http://schema.org/Section">
              <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
                <meta itemprop="name" content="New York Times"/>
                <meta itemprop="productID" content="pub1:premium"/>
              </div>
            </div>
            <div>
              <meta itemprop="isAccessibleForFree" content="False"/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div itemprop="articleBody" class="paywalled-section">
              Paid content possibly.
            </div>
          </div>`;
      addMicrodata(divElement);
      const resolver = new PageConfigResolver(gd);
      expect(resolver.check()).to.be.null;
    });

    it('multiple product info but one valid', async () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML = `<div itemscope itemtype="http://schema.org/NewsArticle">
           <div itemscope itemtype="http://schema.org/Section">
              <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
                <meta itemprop="name" content="New York Times"/>
                <meta itemprop="productID" content="pub1:basic"/>
              </div>
            </div>
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
              <meta itemprop="name" content="New York Times"/>
              <meta itemprop="productID" content="pub1:premium"/>
            </div>
            <div>
              <meta itemprop="isAccessibleForFree" content="False"/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div itemprop="articleBody" class="paywalled-section">
              Paid content possibly.
            </div>
          </div>`;
      addMicrodata(divElement);
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:premium');
    });

    it('multiple access info but one valid', async () => {
      const divElement = createElement(doc, 'div');
      divElement.innerHTML = `<div itemscope itemtype="http://schema.org/NewsArticle">
            <div itemprop="isPartOf" itemscope itemtype="http://schema.org/CreativeWork http://schema.org/Product">
              <meta itemprop="name" content="New York Times"/>
              <meta itemprop="productID" content="pub1:premium"/>
            </div>
            <div itemprop="hasPart" itemscope itemtype="http://schema.org/WebPageElement">
              <meta itemprop="isAccessibleForFree" content="True"/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div>
              <meta itemprop="isAccessibleForFree" content="False"/>
              <meta itemprop="cssSelector" content=".paywalled-section"/>
            </div>
            <div itemprop="articleBody" class="paywalled-section">
              Paid content possibly.
            </div>
          </div>`;
      addMicrodata(divElement);
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:premium');
    });
  });

  describe('locked', () => {
    it('should parse locked', async () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'false');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:label1');
    });

    it('should parse locked in other forms', async () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'FALSE');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.true;
      expect(config.getProductId()).to.equal('pub1:label1');
    });

    it('should parse unlocked', async () => {
      addMeta('subscriptions-product-id', 'pub1:label1');
      addMeta('subscriptions-accessible-for-free', 'true');
      const config = await new PageConfigResolver(gd).resolveConfig();
      expect(config.isLocked()).to.be.false;
      expect(config.getProductId()).to.equal('pub1:label1');
    });
  });

  describe('control flag', () => {
    it('should parse as null if not found', () => {
      expect(getControlFlag(doc)).to.be.null;
    });

    it('should parse from a meta tag', () => {
      addMeta('subscriptions-control', 'auto');
      expect(getControlFlag(doc)).to.equal('auto');
    });

    it('should parse from a script tag', () => {
      doc.head.appendChild(
        createElement(doc, 'script', {
          'subscriptions-control': 'manual',
        })
      );
      expect(getControlFlag(doc)).to.equal('manual');
    });

    it('should prefer meta tag', () => {
      addMeta('subscriptions-control', 'auto');
      doc.head.appendChild(
        createElement(doc, 'script', {
          'subscriptions-control': 'manual',
        })
      );
      expect(getControlFlag(doc)).to.equal('auto');
    });
  });
});

describes.sandboxed('PageConfig', {}, () => {
  it('should create from product id', () => {
    const config = new PageConfig('a.b.c.pub1:d.e.f');
    expect(config.getPublicationId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.equal('a.b.c.pub1:d.e.f');
    expect(config.getLabel()).to.equal('d.e.f');
  });

  it('should create from publication id', () => {
    const config = new PageConfig('a.b.c.pub1');
    expect(config.getPublicationId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.be.null;
    expect(config.getLabel()).to.be.null;
  });

  it('should tolerate unusual labels', () => {
    const config = new PageConfig('a.b.c.pub1:d:e.f');
    expect(config.getPublicationId()).to.equal('a.b.c.pub1');
    expect(config.getProductId()).to.equal('a.b.c.pub1:d:e.f');
    expect(config.getLabel()).to.equal('d:e.f');
  });

  it('should configure locked', () => {
    expect(new PageConfig('a:b', true).isLocked()).to.be.true;
    expect(new PageConfig('a:b', false).isLocked()).to.be.false;
  });
});
