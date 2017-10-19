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

import * as st from './style';

describes.realWin('Types', {}, env => {
  let win;
  let doc;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
  });

  describe('Style', () => {
    it('toggle', () => {
      const element = doc.createElement('div');
      st.toggle(element);
      expect(element.style.display).to.equal('none');
      st.toggle(element);
      expect(element.style.display).to.equal('');
      st.toggle(element, true);
      expect(element.style.display).to.equal('');
      st.toggle(element, false);
      expect(element.style.display).to.equal('none');
    });

    it('setStyle', () => {
      const element = doc.createElement('div');
      st.setStyle(element, 'width', '1px');
      expect(element.style.width).to.equal('1px');
    });

    it('setStyle with vendor prefix', () => {
      const element = {style: {WebkitTransitionDuration: ''}};
      st.setStyle(element, 'transitionDuration', '1s', undefined, true);
      expect(element.style.WebkitTransitionDuration).to.equal('1s');
    });

    it('setStyles', () => {
      const element = doc.createElement('div');
      st.setStyles(element, {
        width: st.px(101),
        height: st.px(102),
      });
      expect(element.style.width).to.equal('101px');
      expect(element.style.height).to.equal('102px');
    });

    it('px', () => {
      expect(st.px(0)).to.equal('0px');
      expect(st.px(101)).to.equal('101px');
    });

    it('translateX', () => {
      expect(st.translateX(101)).to.equal('translateX(101px)');
      expect(st.translateX('101vw')).to.equal('translateX(101vw)');
    });

    it('translate', () => {
      expect(st.translate(101, 201)).to.equal('translate(101px, 201px)');
      expect(st.translate('101vw, 201em')).to.equal('translate(101vw, 201em)');
      expect(st.translate(101)).to.equal('translate(101px)');
      expect(st.translate('101vw')).to.equal('translate(101vw)');
    });

    it('camelCaseToTitleCase', () => {
      const str = 'theQuickBrownFox';
      expect(st.camelCaseToTitleCase(str)).to.equal('TheQuickBrownFox');
    });

    it('removeAlphaFromColor', () => {
      expect(st.removeAlphaFromColor('rgba(1, 1, 1, 0)')).to.equal(
          'rgba(1, 1, 1, 1)');
      expect(st.removeAlphaFromColor('rgb(1, 1, 1)')).to.equal(
          'rgb(1, 1, 1)');
      expect(st.removeAlphaFromColor('rgba(0, 0, 0,-0.5)')).to.equal(
          'rgba(0, 0, 0, 1)');
    });

    describe('getVendorJsPropertyName', () => {

      it('no prefix', () => {
        const element = {style: {transitionDuration: ''}};
        const prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration', true);
        expect(prop).to.equal('transitionDuration');
      });

      it('should use cached previous result', () => {
        let element = {style: {transitionDuration: ''}};
        let prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration');
        expect(prop).to.equal('transitionDuration');

        element = {style: {WebkitTransitionDuration: ''}};
        prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration');
        expect(prop).to.equal('transitionDuration');
      });

      it('Webkit', () => {
        const element = {style: {WebkitTransitionDuration: ''}};
        const prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration', true);
        expect(prop).to.equal('WebkitTransitionDuration');
      });

      it('Moz', () => {
        const element = {style: {MozTransitionDuration: ''}};
        const prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration', true);
        expect(prop).to.equal('MozTransitionDuration');
      });

      it('ms', () => {
        const element = {style: {msTransitionDuration: ''}};
        const prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration', true);
        expect(prop).to.equal('msTransitionDuration');
      });

      it('O opera', () => {
        const element = {style: {OTransitionDuration: ''}};
        const prop = st
          .getVendorJsPropertyName(element.style, 'transitionDuration', true);
        expect(prop).to.equal('OTransitionDuration');
      });
    });

    describe('injectStyles', () => {

      it('should inject the style in the HEAD section', () => {
        const query = 'head style';
        const existingStylesCount =
            doc.querySelectorAll(query).length;
        const styles = 'body{padding:0;margin:0}';
        st.injectStyles(doc, styles);
        const newStylesCount =
            doc.querySelectorAll(query).length;
        expect(newStylesCount).to.equal(existingStylesCount + 1);
        const styleList = doc.querySelectorAll(query);
        const newStyle = styleList.item(styleList.length - 1).textContent;
        expect(newStyle).to.equal(styles);
      });
    });

    describe('injectFontsUrl', () => {

      it('should add the style link in the HEAD section', () => {
        const query = 'head link[rel=stylesheet][href]';
        const fontsUrl =
            'https://fonts.googleapis.com/css?family=Roboto:300,400,500,700';
        const existingLinksCount =
            doc.querySelectorAll(query).length;

        st.injectFontsUrl(doc, fontsUrl);
        // Try injecting same style with trailing "/". Should not inject.
        st.injectFontsUrl(doc, `${fontsUrl}/`);
        const newLinksCount =
            doc.querySelectorAll(query).length;
        expect(newLinksCount).to.equal(existingLinksCount + 1);

        const linkList = doc.querySelectorAll(query);
        const newLink = linkList.item(linkList.length - 1);
        expect(newLink.href).to.equal(fontsUrl);
        expect(newLink.rel).to.equal(st.styleLinkAttrs.rel);
        expect(newLink.type).to.equal(st.styleLinkAttrs.type);
      });
    });

  });
});
