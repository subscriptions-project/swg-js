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

import {FriendlyIframe} from './friendly-iframe';
import {getStyle, setImportantStyles, setStyles} from '../utils/style';

/** @const {!Object<string, string|number} */
const importantStyles = {
  'min-height': '50px',
  'opacity': 1,
  'border': 'none',
  'display': 'block',
  'background-color': 'rgb(255, 255, 255)',
  'font-family': 'Google sans, sans-serif',
  'position': 'fixed',
  'bottom': '0px',
  'z-index': '2147483647',
  'box-shadow': 'gray 0px 3px, gray 0px 0px 22px',
  'box-sizing': 'border-box',
};

describes.realWin('FriendlyIframe', {}, (env) => {
  let doc;
  let friendlyIframe;

  beforeEach(() => {
    doc = env.win.document;
    friendlyIframe = new FriendlyIframe(doc, {'class': 'swg-dialog'});
  });

  describe('friendlyIframe', () => {
    it('should have created a friendly iframe instance', async () => {
      expect(friendlyIframe.isConnected()).to.be.false;
      doc.body.appendChild(friendlyIframe.getElement());
      await friendlyIframe.whenReady();

      const iframe = friendlyIframe.getElement();
      const iframeDocument = friendlyIframe.getDocument();
      const iframeBody = friendlyIframe.getBody();

      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframe.getAttribute('class')).to.equal('swg-dialog');
      expect(iframeDocument.nodeType).to.equal(9 /* Document */);
      expect(iframeDocument.nodeName).to.equal('#document');
      expect(iframeBody.nodeType).to.equal(1 /* Element */);
      expect(iframeBody.parentElement.nodeName).to.equal('HTML');
      expect(iframeBody.nodeName).to.equal('BODY');
      expect(friendlyIframe.isConnected()).to.be.true;

      setImportantStyles(iframe, importantStyles);
      setStyles(iframe);

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'display')).to.equal('block');
      expect(getStyle(iframe, 'background-color')).to.equal(
        'rgb(255, 255, 255)'
      );
      expect(getStyle(iframe, 'position')).to.equal('fixed');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
    });
  });
});
