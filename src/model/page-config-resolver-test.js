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

  it('should parse publication id and label', () => {
    addMeta('subscriptions-publication-id', 'pub1');
    addMeta('subscriptions-product-label', 'label1');
    return new PageConfigResolver(win).resolveConfig().then(config => {
      expect(config.getPublicationId()).to.equal('pub1');
      expect(config.getLabel()).to.equal('label1');
    });
  });

  it('should parse publication id and null label', () => {
    addMeta('subscriptions-publication-id', 'pub1');
    return new PageConfigResolver(win).resolveConfig().then(config => {
      expect(config.getPublicationId()).to.equal('pub1');
      expect(config.getLabel()).to.be.null;
    });
  });
});
