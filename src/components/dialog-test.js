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
  computedStyle,
  getStyle,
  googleFontsUrl,
} from '../utils/style';

describes.realWin('Dialog', {}, env => {
  let win;
  let doc;
  let dialog;
  let view;
  let element;
  const documentHeight = 100;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    dialog = new Dialog(win, {height: `${documentHeight}px`});

    element = doc.createElement('div');
    view = {
      getElement: function() {
        return element;
      },
      init: function(dialog) {
        return Promise.resolve(dialog);
      },
      resized: function() {
        return;
      },
    };
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

    it('should build the view', function* () {
      const openedDialog = yield dialog.open();
      yield openedDialog.openView(view);
      expect(computedStyle(win, element)['opacity']).to.equal('1');
    });

    it('should resize the element', function* () {
      const openedDialog = yield dialog.open();
      yield openedDialog.openView(view);
      openedDialog.resizeView(view, '99');
      // TODO(dparikh): When animiation is implemented, need to wait for
      // resized() call.
      expect(computedStyle(win, dialog.getElement())['height'])
          .to.equal('99px');
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

    it('should return the dialog position', function* () {
      yield dialog.open();

      expect(win.document.documentElement.style.paddingBottom)
          .to.equal(`${documentHeight + 20}px`);
    });

    it('should have Close button with click listener', function* () {
      const openedDialog = yield dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const closeButton = iframeDoc.querySelector('.swg-close-action');
      expect(closeButton.nodeName).to.equal('DIV');

      // Before closing the dialog, check that iframe exists in document.
      expect(doc.querySelector('iframe')).to.equal(openedDialog.getElement());

      // Clicking the close button should remove the dialog from the document.
      closeButton.click();

      // Check that container iframe does not exist any more.
      expect(doc.querySelector('iframe')).to.be.null;
    });

    it('should have Close button with keypress="Enter" listener', function* () {
      const openedDialog = yield dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const closeButton = iframeDoc.querySelector('.swg-close-action');
      expect(closeButton.nodeName).to.equal('DIV');

      // Before closing the dialog, check that iframe exists in document.
      expect(doc.querySelector('iframe')).to.equal(openedDialog.getElement());

      // Presseing the Enter key should remove the dialog from the document.
      closeButton.dispatchEvent(new KeyboardEvent('keypress',{'key': 'Enter'}));

      // Check that container iframe does not exist any more.
      expect(doc.querySelector('iframe')).to.be.null;
    });

    it('should have Loading view element added', function* () {
      const openedDialog = yield dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const loadingView = iframeDoc.querySelector('.swg-loading');
      expect(loadingView.nodeName).to.equal('DIV');

      expect(loadingView.children.length).to.equal(4);
    });

    it('should create a dialog without Close action button', function* () {
      const dialogNoClose =
          new Dialog(win, {height: `${documentHeight}px`}, null, null, false);
      const openedDialogNoClose = yield dialogNoClose.open();
      const iframeDoc = openedDialogNoClose.getIframe().getDocument();
      let closeButton = iframeDoc.querySelector('.swg-close-action');
      expect(computedStyle(win, closeButton)['display']).to.equal('none');

      openedDialogNoClose.showCloseAction(true);
      closeButton = iframeDoc.querySelector('.swg-close-action');
      expect(computedStyle(win, closeButton)['display']).to.not.equal('none');
    });
  });
});
