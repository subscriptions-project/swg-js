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

import * as dom from './dom';


describes.realWin('Dom', {}, env => {
  let doc;

  beforeEach(() => {
    doc = env.win.document;
  });

  describe('Dom', () => {

    it('should inject the style in the HEAD section', () => {
      const query = 'head style';
      const existingStylesCount =
             doc.querySelectorAll(query).length;
      const styles = 'body{padding:0;margin:0}';
      dom.injectStyleSheet(doc, styles);
      const newStylesCount =
             doc.querySelectorAll(query).length;
      expect(newStylesCount).to.equal(existingStylesCount + 1);
      const styleList = doc.querySelectorAll(query);
      const newStyle = styleList.item(styleList.length - 1).textContent;
      expect(newStyle).to.equal(styles);
    });

    it('should add the style link in the HEAD section', () => {
      const query = 'head link[rel=stylesheet][href]';
      const fontsUrl =
             'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';
      const existingLinksCount =
             doc.querySelectorAll(dom.styleExistsQuerySelector).length;

      dom.injectFontsLink(doc, fontsUrl);
         // Try injecting same style with trailing "/". Should not inject.
      dom.injectFontsLink(doc, `${fontsUrl}/`);
      const newLinksCount =
             doc.querySelectorAll(query).length;
      expect(newLinksCount).to.equal(existingLinksCount + 1);

      const linkList = doc.querySelectorAll(dom.styleExistsQuerySelector);
      const newLink = linkList.item(linkList.length - 1);
      expect(newLink.href).to.equal(fontsUrl);
      expect(newLink.rel).to.equal(dom.styleLinkAttrs.rel);
      expect(newLink.type).to.equal(dom.styleLinkAttrs.type);
    });

    it('should create an element with attributes', () => {
      const attrs = {
        'frameborder': 0,
        'scrolling': 'no',
        'width': '100%',
        'height': '100%',
      };
      const element = dom.createElement(doc, 'iframe', attrs);
      expect(element.getAttribute('frameborder'))
          .to.equal(attrs['frameborder'].toString());
      expect(element.getAttribute('scrolling')).to.equal(attrs['scrolling']);
      expect(element.getAttribute('width')).to.equal(attrs['width']);
      expect(element.getAttribute('height')).to.equal(attrs['height']);
      expect(element.getAttribute('border')).to.equal(null);
      expect(element.getAttribute('class')).to.equal(null);
      expect(element.getAttribute('style')).to.equal(null);
    });

    it('should create an element with no attributes', () => {
      const element = dom.createElement(doc, 'iframe', {});
      expect(element.getAttribute('frameborder')).to.equal(null);
      expect(element.getAttribute('scrolling')).to.equal(null);
      expect(element.getAttribute('border')).to.equal(null);
    });

    it('should create style and other attributes', () => {
      const attrs = {
        'style': {
          'min-height': '100px',
          'display': 'none',
          'opacity': 1,
        },
        'width': '100%',
        'height': '100%',
      };

      const element = dom.createElement(doc, 'div', attrs);
      expect(element.getAttribute('width')).to.equal(attrs['width']);
      expect(element.getAttribute('width')).to.equal(attrs['height']);
      expect(element.style['min-height'])
          .to.equal(attrs['style']['min-height']);
      expect(element.style['display'])
          .to.equal(attrs['style']['display']);
      expect(element.style['opacity'])
          .to.equal(attrs['style']['opacity'].toString());
    });
  });
});
