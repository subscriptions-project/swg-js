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

import {Dialog} from './dialog';
import {
  getStyle,
  googleFontsUrl,
} from '../utils/style';

describes.realWin('Dialog', {}, env => {
  let doc;
  let dialog;

  beforeEach(() => {
    doc = env.win.document;
    dialog = new Dialog(doc);
  });

  describe('dialog', () => {

    it('should have created a friendly iframe instance', function* () {
      const iframe = dialog.getElement();
      expect(iframe.nodeType).to.equal(1);
      expect(iframe.nodeName).to.equal('IFRAME');

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'font-family')).to.equal('Roboto, sans-serif');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
      expect(getStyle(iframe, 'display')).to.equal('block');
      // These two properties are not set !important.
      expect(getStyle(iframe, 'width')).to.equal('100%');
      expect(getStyle(iframe, 'left')).to.equal('0px');
    });

    it('should open the dialog', function* () {

      const openedDialog = yield dialog.open();
      expect(openedDialog.getContainer().getAttribute('class'))
          .to.equal('swg-container');

      // Should have top level friendly iframe created.
      const iframe = openedDialog.getElement();
      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframe.nodeName).to.equal('IFRAME');

      // Should have document loaded.
      const iframeDoc = openedDialog.getIframe().getDocument();
      expect(iframeDoc.nodeType).to.equal(9);
      expect(iframeDoc.nodeName).to.equal('#document');

      // Should have Google fonts link added to the HEAD section.
      const fontsLink =
          iframeDoc.querySelector('link[rel="stylesheet"][type="text/css"]');
      expect(fontsLink.getAttribute('href')).to.equal(googleFontsUrl);

      // Should have container created.
      const container = openedDialog.getContainer();
      expect(container.nodeType).to.equal(1);
      expect(container.nodeName).to.equal('DIV');
      expect(container.getAttribute('class')).to.equal('swg-container');
    });

    it('should remove the dialog', function* () {
      const openedDialog = yield dialog.open();
      expect(openedDialog.getContainer().getAttribute('class'))
          .to.equal('swg-container');

      // Should have top level friendly iframe created.
      const iframe = openedDialog.getElement();
      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframe.nodeName).to.equal('IFRAME');
      expect(doc.querySelector('iframe')).to.equal(iframe);
      expect(openedDialog.getIframe().isConnected()).to.equal(true);

      // Remove the element from the dom.
      dialog.close();

      expect(doc.querySelector('iframe')).to.be.null;
      expect(openedDialog.getIframe().isConnected()).to.equal(false);
    });
  });
});
