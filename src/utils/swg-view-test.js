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

import {SwgView, IFRAME_STYLES} from './swg-view';

/**
 * Parses 'style' attribute string into an Object of key value pair for
 * validation.
 */
function parseStyle(styleString = '') {
  if (styleString == '') {
    return;
  }

  return styleString.split(';').reduce((result, style) => {
    const currentStyle = style.split(':');
    const key = (currentStyle[0] || '').trim();
    const val = (currentStyle[1] || '').trim();

    if (key != '' && val != '') {
      result.push({[key]: val});
    }
    return result;
  }, []);
}

describes.realWin('SwgView', {}, env => {
  let doc;
  let win;
  let swgView;

  beforeEach(() => {
    doc = env.win.document;
    win = env.win;
    swgView = new SwgView(win);
  });

  describe('SwgView', () => {

    it('should create a swg-iframe in the body of the document', () => {
      return swgView.init(doc).then(body => {
        const iframe = doc.getElementById('swg-iframe');

        expect(iframe.srcdoc).to.equal('<h1>Fake iframe</h1>');
        expect(iframe.getAttribute('id')).to.equal('swg-iframe');
        expect(iframe.getAttribute('frameorder')).to.equal('0');
        expect(iframe.getAttribute('scrolling')).to.equal('no');
        expect(iframe.getAttribute('src')).to.equal('about:blank');

        const styles = parseStyle(iframe.getAttribute('style'));

        for (const key in IFRAME_STYLES) {
          const styleItem =
              styles.find(style => {
                return style[key] != undefined;
              });
          // TODO(dparikh): Check this with other browsers, if the style
          // attributes are modified or not.
          expect(styleItem[key]).to.equal(`${IFRAME_STYLES[key]} !important`);
        };

        const closeButton = body.querySelector('.swg-close-action');
        expect(closeButton.tagName).to.equal('DIV');
        expect(closeButton.getAttribute('class')).to.equal('swg-close-action');
        expect(closeButton.getAttribute('role')).to.equal('button');
        expect(closeButton.getAttribute('aria-label')).to.equal('Close');

        // Check some of the expected CSS styles are applied from class name.
        expect(win.getComputedStyle(closeButton)['position'])
            .to.equal('absolute');
        expect(win.getComputedStyle(closeButton)['top']).to.equal('20px');
        expect(win.getComputedStyle(closeButton)['padding']).to.equal('0px');
        expect(win.getComputedStyle(closeButton)['margin']).to.equal('0px');

        const googleBar = body.querySelector('.swg-google-bar');
        expect(googleBar.tagName).to.equal('DIV');
        expect(googleBar.children.length).to.equal(4);
        expect(googleBar.getAttribute('class')).to.equal('swg-google-bar');

        const firstBar = googleBar.firstChild;
        expect(firstBar.getAttribute('class')).to.equal('swg-bar');
        expect(firstBar.tagName).to.equal('DIV');

        // Check some of the expected CSS styles are applied from class name.
        expect(win.getComputedStyle(googleBar)['position']).to.equal('static');
        expect(win.getComputedStyle(googleBar)['height']).to.equal('4px');
        expect(win.getComputedStyle(googleBar)['padding']).to.equal('0px');
        expect(win.getComputedStyle(googleBar)['margin']).to.equal('0px');
      });
    });
  });
});
