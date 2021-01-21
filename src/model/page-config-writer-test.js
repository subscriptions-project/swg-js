/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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
import {PageConfigWriter} from './page-config-writer';
import {createElement} from '../utils/dom';

describes.realWin('PageConfigWriter', {}, (env) => {
  let win, doc, gd, markupConfig;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    gd = new GlobalDoc(win);
    markupConfig = {
      type: 'CreativeWork',
      isAccessibleForFree: true,
      isPartOfType: ['CreativeWork', 'Product'],
      isPartOfProductId: 'scenic-2017.appspot.com:news',
    };
  });

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

  describe('write json-ld', () => {
    let readyState;

    beforeEach(() => {
      readyState = 'loading';
      Object.defineProperty(doc, 'readyState', {get: () => readyState});
    });

    it('should wait until the element is ready (dom ready)', async () => {
      const configWriter = new PageConfigWriter(gd);
      configWriter.writeConfigWhenReady(markupConfig);
      expect(gd.getHead().childElementCount).to.equal(0);
    });

    it('should write the config after the doc is read', async () => {
      readyState = 'complete';
      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
    });

    it('should write a new node if there is no existing schema', async () => {
      readyState = 'complete';
      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
      expect(gd.getHead().firstChild.textContent).to.equal(
        JSON.stringify({
          '@type': 'CreativeWork',
          'isAccessibleForFree': true,
          'isPartOf': {
            'productID': 'scenic-2017.appspot.com:news',
            '@type': ['CreativeWork', 'Product'],
          },
        })
      );
    });

    it('should only write a new node once, regardless of the number of calls', async () => {
      readyState = 'complete';
      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
      expect(gd.getHead().firstChild.textContent).to.equal(
        JSON.stringify({
          '@type': 'CreativeWork',
          'isAccessibleForFree': true,
          'isPartOf': {
            'productID': 'scenic-2017.appspot.com:news',
            '@type': ['CreativeWork', 'Product'],
          },
        })
      );
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
    });

    it('should write a new node if there is an existing but invalid schema', async () => {
      const invalidSchema = {
        '@context': 'http://schema.org',
        '@type': 'WrongType',
        'isAccessibleForFree': 'False',
        'isPartOf': {
          '@type': ['CreativeWork', 'Product'],
          'name': 'The Times Journal',
          'productID': 'pub1:basic',
        },
      };
      addJsonLd(invalidSchema);
      readyState = 'complete';

      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
      expect(gd.getHead().firstChild.textContent).to.equal(
        JSON.stringify({
          '@type': 'CreativeWork',
          'isAccessibleForFree': true,
          'isPartOf': {
            'productID': 'scenic-2017.appspot.com:news',
            '@type': ['CreativeWork', 'Product'],
          },
        })
      );
    });

    it('should write a new node if there is an existing but malformed schema', async () => {
      const element = createElement(
        doc,
        'script',
        {
          type: 'application/ld+json',
        },
        '{malformed markup'
      );
      doc.body.appendChild(element);
      readyState = 'complete';

      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
    });

    it('should write a new node if there is an existing JSON+LD script node without any content', async () => {
      const element = createElement(doc, 'script', {
        type: 'application/ld+json',
      });
      doc.body.appendChild(element);
      readyState = 'complete';

      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getHead().childNodes).to.have.length(1);
    });

    it('should merge metadata for an existing valid schema', async () => {
      const validIncompleteSchema = {
        '@context': 'http://schema.org',
        '@type': 'NewsArticle',
        'isPartOf': {
          'name': 'The Times Journal',
          'productID': 'pub1:basic',
        },
      };
      addJsonLd(validIncompleteSchema);
      expect(gd.getBody().childNodes).to.have.length(1);
      readyState = 'complete';

      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getBody().childNodes).to.have.length(1);
      expect(gd.getBody().firstChild.textContent).to.equal(
        JSON.stringify({
          '@type': 'NewsArticle',
          'isAccessibleForFree': true,
          'isPartOf': {
            'productID': 'pub1:basic',
            '@type': ['CreativeWork', 'Product'],
            'name': 'The Times Journal',
          },
          '@context': 'http://schema.org',
        })
      );
    });

    it('should merge metadata for an existing valid schema, within a list of schemas', async () => {
      const multipleValidSchemas = [
        {
          '@context': 'http://schema.org',
          '@type': 'NewsArticle',
          'isPartOf': {
            'name': 'The Times Journal',
            'productID': 'pub1:basic',
          },
        },
        {
          '@context': 'http://schema.org',
          '@type': 'NewsArticle',
          'isPartOf': {
            'name': 'The Times Journal',
            'productID': 'pub1:basic',
          },
        },
      ];
      addJsonLd(multipleValidSchemas);
      expect(gd.getBody().childNodes).to.have.length(1);
      readyState = 'complete';

      const configWriter = new PageConfigWriter(gd);
      await expect(configWriter.writeConfigWhenReady(markupConfig)).to.be
        .eventually.fulfilled;
      expect(gd.getBody().childNodes).to.have.length(1);
      // The first schema should be merged, the second schema should be
      // unmodified.
      expect(gd.getBody().firstChild.textContent).to.equal(
        JSON.stringify([
          {
            '@type': 'NewsArticle',
            'isAccessibleForFree': true,
            'isPartOf': {
              'productID': 'pub1:basic',
              '@type': ['CreativeWork', 'Product'],
              'name': 'The Times Journal',
            },
            '@context': 'http://schema.org',
          },
          {
            '@context': 'http://schema.org',
            '@type': 'NewsArticle',
            'isPartOf': {
              'name': 'The Times Journal',
              'productID': 'pub1:basic',
            },
          },
        ])
      );
    });
  });
});
