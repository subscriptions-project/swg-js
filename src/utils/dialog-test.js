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

import {getStyle} from './style';
import {
  Dialog,
  CONTAINER_HEIGHT,
  GOOGLE_FONTS_URL,
  IFRAME_STYLES,
} from './dialog';


describes.realWin('Dialog', {}, env => {
  let doc;
  let win;
  let dialog;

  beforeEach(() => {
    doc = env.win.document;
    win = env.win;
    dialog = new Dialog(win);
  });

  describe('dialog', () => {

    it('should have container height value equal to 50', () => {
      expect(CONTAINER_HEIGHT).to.equal(50);
    });

    it('should have valid https Url and fetch the fonts', function* () {
      const response = yield fetch(GOOGLE_FONTS_URL);
      expect(/^https:/.test(GOOGLE_FONTS_URL)).to.be.true;
      expect(response.ok).to.be.true;
      expect(response.status).to.equal(200);
    });

    it('should have called Dialog constructor', () => {
      expect(dialog.win).to.be.defined;
      expect(dialog.viewElement).to.be.undefined;
    });

    it('should create a swg-iframe in the body of the document', () => {
      return dialog.init(doc).then(body => {
        expect(dialog.viewElement).to.be.defined;
        const iframe = doc.getElementById('swg-iframe');

        expect(iframe.srcdoc).to.equal('<h1>Fake iframe</h1>');
        expect(iframe.getAttribute('id')).to.equal('swg-iframe');
        expect(iframe.getAttribute('frameorder')).to.equal('0');
        expect(iframe.getAttribute('scrolling')).to.equal('no');
        expect(iframe.getAttribute('src')).to.equal('about:blank');

        for (const key in IFRAME_STYLES) {
          const styleValue = getStyle(iframe, key);
          expect(styleValue).to.equal(IFRAME_STYLES[key].toString());
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
