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
      const newStyle = styleList.item(styleList.length - 1);
      const newStyleContent = newStyle.textContent;
      expect(newStyleContent).to.equal(styles);
      expect(newStyle.type).to.equal(dom.styleType);
    });

    it('should add the style link in the HEAD section', () => {
      const query = 'head link[rel=stylesheet][href]';
      const fontsUrl =
             'https://fonts.googleapis.com/css?family=Google+sans:300,400,500,700';
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
      expect(element.firstChild).to.be.null;
    });

    it('should create an element with no attributes', () => {
      const element = dom.createElement(doc, 'iframe', {});
      expect(element.getAttribute('frameborder')).to.equal(null);
      expect(element.getAttribute('scrolling')).to.equal(null);
      expect(element.getAttribute('border')).to.equal(null);
      expect(element.firstChild).to.be.null;
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
      expect(element.firstChild).to.be.null;
    });

    it('should create an element with empty text content', () => {
      const element = dom.createElement(doc, 'div', {}, '');
      expect(element.firstChild).to.be.null;
      expect(element.textContent).to.equal('');
    });

    it('should create an element with text content', () => {
      const element = dom.createElement(doc, 'div', {}, 'A');
      expect(element.childNodes).to.have.length(1);
      expect(element.textContent).to.equal('A');
    });

    it('should create an element with element as content', () => {
      const child = dom.createElement(doc, 'a');
      const element = dom.createElement(doc, 'div', {}, child);
      expect(element.childNodes).to.have.length(1);
      expect(element.firstChild).to.equal(child);
    });

    it('should create an element with an array of element as content', () => {
      const child1 = dom.createElement(doc, 'a');
      const child2 = dom.createElement(doc, 'a');
      const element = dom.createElement(doc, 'div', {}, [child1, child2]);
      expect(element.childNodes).to.have.length(2);
      expect(element.children[0]).to.equal(child1);
      expect(element.children[1]).to.equal(child2);
    });

    it('should create an element with illegal content', () => {
      expect(() => {
        dom.createElement(doc, 'div', {}, {});
      }).to.throw(/Unsupported content/);
    });

    it('should remove element', () => {
      const element = dom.createElement(doc, 'div', {});
      const childElement = dom.createElement(doc, 'div', {});
      element.appendChild(childElement);

      expect(element.children.length).to.equal(1);
      expect(element.firstChild).to.not.equal(null);

      dom.removeElement(childElement);
      expect(element.children.length).to.equal(0);
      expect(element.firstChild).to.equal(null);
    });

    it('should remove all the children', () => {
      const element = dom.createElement(doc, 'div', {});
      element.textContent = 'Some text';
      const childElement1 = dom.createElement(doc, 'div', {});
      const childElement2 = dom.createElement(doc, 'div', {});
      element.appendChild(childElement1);
      element.appendChild(childElement2);

      expect(element.children.length).to.equal(2);
      expect(element.firstChild).to.not.equal(null);

      dom.removeChildren(element);
      expect(element.children.length).to.equal(0);
      expect(element.firstChild).to.equal(null);
    });

    describe('openWindowDialog', () => {
      let windowApi;
      let windowMock;

      beforeEach(() => {
        windowApi = {
          open: () => {throw new Error('not mocked');},
        };
        windowMock = sandbox.mock(windowApi);
      });

      afterEach(() => {
        windowMock.verify();
      });

      it('should return on first success', () => {
        const dialog = {};
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .returns(dialog)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_blank', 'width=1');
        expect(res).to.equal(dialog);
      });

      it('should retry on first null', () => {
        const dialog = {};
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .returns(null)
            .once();
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top')
            .returns(dialog)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_blank', 'width=1');
        expect(res).to.equal(dialog);
      });

      it('should retry on first undefined', () => {
        const dialog = {};
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .returns(undefined)
            .once();
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top')
            .returns(dialog)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_blank', 'width=1');
        expect(res).to.equal(dialog);
      });

      it('should retry on first exception', () => {
        const dialog = {};
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .throws(new Error('intentional'))
            .once();
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top')
            .returns(dialog)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_blank', 'width=1');
        expect(res).to.equal(dialog);
      });

      it('should return the final result', () => {
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .returns(undefined)
            .once();
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top')
            .returns(null)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_blank', 'width=1');
        expect(res).to.be.null;
      });

      it('should return the final exception', () => {
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_blank', 'width=1')
            .throws(new Error('intentional1'))
            .once();
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top')
            .throws(new Error('intentional2'))
            .once();
        expect(() => {
          dom.openWindowDialog(windowApi, 'https://example.com/',
              '_blank', 'width=1');
        }).to.throw(/intentional2/);
      });

      it('should retry only non-top target', () => {
        windowMock.expects('open')
            .withExactArgs('https://example.com/', '_top', 'width=1')
            .returns(null)
            .once();
        const res = dom.openWindowDialog(windowApi, 'https://example.com/',
            '_top', 'width=1');
        expect(res).to.be.null;
      });

      it('should return the BODY element of the document', () => {
        expect(dom.getBody(doc).nodeType).to.equal(1);
        expect(dom.getBody(doc).nodeName).to.equal('BODY');
      });
    });
  });

  describe('hasNextNodeInDocumentOrder', () => {
    it('should return true when the element has a nextSibling', () => {
      const element = doc.createElement('div');
      const parent = doc.createElement('div');
      const sibling = doc.createElement('div');
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.false;
      parent.appendChild(element);
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.false;
      parent.appendChild(sibling);
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.true;
    });

    it('should return true when element ancestor has nextSibling', () => {
      const element = doc.createElement('div');
      const parent = doc.createElement('div');
      const uncle = doc.createElement('div');
      const ancestor = doc.createElement('div');
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.false;
      ancestor.appendChild(parent);
      ancestor.appendChild(uncle);
      parent.appendChild(element);
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.true;
    });

    it('should return false when ancestor with sibling with stop node', () => {
      const element = doc.createElement('div');
      const parent = doc.createElement('div');
      const uncle = doc.createElement('div');
      const ancestor = doc.createElement('div');
      ancestor.appendChild(parent);
      ancestor.appendChild(uncle);
      parent.appendChild(element);
      expect(dom.hasNextNodeInDocumentOrder(element)).to.be.true;
      expect(dom.hasNextNodeInDocumentOrder(element, parent)).to.be.false;
    });
  });
});
