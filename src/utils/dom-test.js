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

import * as dom from './dom';
import {resolveDoc} from '../model/doc';

describes.realWin('Dom', {}, env => {
  let doc;

  beforeEach(() => {
    doc = env.win.document;
  });

  describe('Dom', () => {
    it('should inject the style in the HEAD section', () => {
      const query = 'head style';
      const existingStylesCount = doc.querySelectorAll(query).length;
      const styles = 'body{padding:0;margin:0}';
      dom.injectStyleSheet(resolveDoc(doc), styles);
      const newStylesCount = doc.querySelectorAll(query).length;
      expect(newStylesCount).to.equal(existingStylesCount + 1);
      const styleList = doc.querySelectorAll(query);
      const newStyle = styleList.item(styleList.length - 1);
      const newStyleContent = newStyle.textContent;
      expect(newStyleContent).to.equal(styles);
      expect(newStyle.type).to.equal(dom.styleType);
    });

    it('should create an element with attributes', () => {
      const attrs = {
        'frameborder': 0,
        'scrolling': 'no',
        'width': '100%',
        'height': '100%',
      };
      const element = dom.createElement(doc, 'iframe', attrs);
      expect(element.getAttribute('frameborder')).to.equal(
        attrs['frameborder'].toString()
      );
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
      expect(element.style['min-height']).to.equal(
        attrs['style']['min-height']
      );
      expect(element.style['display']).to.equal(attrs['style']['display']);
      expect(element.style['opacity']).to.equal(
        attrs['style']['opacity'].toString()
      );
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
  });

  describe('removeElement', () => {
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

    it('should not throw when passed an orphaned element', () => {
      const element = dom.createElement(doc, 'div', {});
      dom.removeElement(element);
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

  describe('isConnected', () => {
    it('should use native isConnected', () => {
      expect(dom.isConnected({isConnected: true})).to.be.true;
      expect(dom.isConnected({isConnected: false})).to.be.false;
    });

    it('should fallback to polyfill w/o native isConnected', () => {
      const doc = {
        documentElement: {
          contains: node => node.connected_,
        },
      };
      expect(dom.isConnected({ownerDocument: doc, connected_: true})).to.be
        .true;
      expect(dom.isConnected({ownerDocument: doc, connected_: false})).to.be
        .false;
    });

    it('should work on actual nodes', () => {
      const node = doc.createElement('div');
      expect(dom.isConnected(node)).to.be.false;
      doc.body.appendChild(node);
      expect(dom.isConnected(node)).to.be.true;
      doc.body.removeChild(node);
      expect(dom.isConnected(node)).to.be.false;
    });
  });

  describe('isLegacyEdgeBrowser', () => {
    it('should return true for legacy Edge browsers', () => {
      const legacyEdgeWindow = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36 Edge/40.15063.0',
        },
      };
      const isLegacyEdge = dom.isLegacyEdgeBrowser(legacyEdgeWindow);
      expect(isLegacyEdge).to.be.true;
    });

    it('should return false for other browsers', () => {
      const newEdgeWindow = {
        navigator: {
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.88 Safari/537.36 Edg/44.18362.449.0',
        },
      };
      const isLegacyEdge = dom.isLegacyEdgeBrowser(newEdgeWindow);
      expect(isLegacyEdge).to.be.false;
    });
  });
});
