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

import {Dialog} from './dialog';
import {GlobalDoc} from '../model/doc';
import {computedStyle, getStyle} from '../utils/style';

const NO_ANIMATE = false;
const ANIMATE = true;
const HIDDEN = true;

describes.realWin('Dialog', {}, (env) => {
  let win;
  let doc;
  let dialog;
  let globalDoc;
  let graypaneStubs;
  let view;
  let element;
  const documentHeight = 100;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    globalDoc = new GlobalDoc(win);
    dialog = new Dialog(globalDoc, {height: `${documentHeight}px`});
    graypaneStubs = sandbox.stub(dialog.graypane_);

    element = doc.createElement('div');
    view = {
      getElement: () => element,
      init: (dialog) => Promise.resolve(dialog),
      resized: () => {},
      shouldFadeBody: () => true,
      hasLoadingIndicator: () => false,
    };
  });

  /** Updates `setTimeout` to immediately call its callback. */
  function immediate() {
    win.setTimeout = (callback) => callback();
  }

  describe('dialog', () => {
    it('should have created a friendly iframe instance', async () => {
      const iframe = dialog.getElement();
      expect(iframe.nodeType).to.equal(1);
      expect(iframe.nodeName).to.equal('IFRAME');

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
      expect(getStyle(iframe, 'display')).to.equal('block');
    });

    it('should have created fade background', async () => {
      expect(graypaneStubs.attach).to.not.be.called;
      const openedDialog = await dialog.open(NO_ANIMATE);
      expect(graypaneStubs.attach).to.be.calledOnce;
      expect(graypaneStubs.show).to.not.be.called;

      await openedDialog.openView(view);
      expect(graypaneStubs.show).to.be.calledOnce.calledWith(ANIMATE);
      expect(graypaneStubs.attach).to.be.calledOnce;
      expect(dialog.graypane_.fadeBackground_.style.zIndex).to.equal(
        '2147483646'
      );
    });

    it('should open dialog with animation', async () => {
      immediate();
      await dialog.open();
      await dialog.animating_;

      expect(getStyle(dialog.getElement(), 'transform')).to.equal(
        'translateY(0px)'
      );
      expect(graypaneStubs.attach).to.be.calledOnce;
      expect(graypaneStubs.show).to.not.be.called;
    });

    it('should open dialog as hidden', async () => {
      immediate();
      await dialog.open(HIDDEN);

      expect(getStyle(dialog.getElement(), 'visibility')).to.equal('hidden');
      expect(getStyle(dialog.getElement(), 'opacity')).to.equal('0');
      await dialog.animating_;
      expect(graypaneStubs.attach).to.be.calledOnce;
      expect(graypaneStubs.show).to.not.be.called;
    });

    it('should build the view', async () => {
      const openedDialog = await dialog.open();
      await openedDialog.openView(view);
      expect(computedStyle(win, element)['opacity']).to.equal('1');
      expect(computedStyle(win, element)['max-height']).to.equal('100%');
      expect(computedStyle(win, element)['max-width']).to.equal('100%');
      expect(computedStyle(win, element)['min-height']).to.equal('100%');
      expect(computedStyle(win, element)['min-width']).to.equal('100%');
      expect(computedStyle(win, element)['height']).to.match(/px$/g);
      expect(computedStyle(win, element)['width']).to.match(/px$/g);
      expect(graypaneStubs.show).to.be.calledOnce.calledWith(ANIMATE);
    });

    it('should build the view and show hidden iframe', async () => {
      const openedDialog = await dialog.open(HIDDEN);
      await openedDialog.openView(view);
      expect(computedStyle(win, element)['visibility']).to.equal('visible');
      expect(computedStyle(win, element)['opacity']).to.equal('1');
      expect(computedStyle(win, element)['max-height']).to.equal('100%');
      expect(computedStyle(win, element)['max-width']).to.equal('100%');
      expect(computedStyle(win, element)['min-height']).to.equal('100%');
      expect(computedStyle(win, element)['min-width']).to.equal('100%');
      expect(computedStyle(win, element)['height']).to.match(/px$/g);
      expect(computedStyle(win, element)['width']).to.match(/px$/g);
      expect(graypaneStubs.show).to.be.calledOnce.calledWith(ANIMATE);
    });

    it('should resize the element', async () => {
      const openedDialog = await dialog.open();
      await openedDialog.openView(view);
      const expectedDialogHeight = 99;
      await openedDialog.resizeView(view, expectedDialogHeight, NO_ANIMATE);
      // TODO(dparikh): When animation is implemented, need to wait for
      // resized() call.
      const measuredDialogHeight =
        // Round the measured height to allow for subpixel differences
        // between browsers & environments.
        Math.round(
          parseFloat(computedStyle(win, dialog.getElement())['height'])
        ) + 'px';
      expect(measuredDialogHeight).to.equal(`${expectedDialogHeight}px`);

      // Check if correct document padding was added.
      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${expectedDialogHeight + 20}px`
      );
    });

    it('should return null if passed wrong view', async () => {
      const wrongView = {};
      expect(dialog.resizeView(wrongView)).to.be.null;
    });

    it('should resize the element to collapse with animation', async () => {
      const newHeight = 99;

      immediate();
      await dialog.open();
      await dialog.openView(view);
      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(getStyle(dialog.getElement(), 'transform')).to.equal(
        'translateY(0px)'
      );
      expect(getStyle(dialog.getElement(), 'height')).to.equal(
        `${newHeight}px`
      );
      // Check if correct document padding was added.
      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${newHeight + 20}px`
      );
    });

    it('resizes the element to expand with an animation', async () => {
      const newHeight = 101;

      immediate();
      await dialog.open();
      await dialog.openView(view);
      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(getStyle(dialog.getElement(), 'transform')).to.equal(
        'translateY(0px)'
      );
      expect(getStyle(dialog.getElement(), 'height')).to.equal(
        `${newHeight}px`
      );
      // Check if correct document padding was added.
      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${newHeight + 20}px`
      );
    });

    it('resizes the element to collapse with an animation', async () => {
      immediate();
      await dialog.open();
      await dialog.openView(view);
      await dialog.resizeView(view, 19, ANIMATE);

      expect(getStyle(dialog.getElement(), 'transform')).to.equal(
        'translateY(0px)'
      );
      expect(getStyle(dialog.getElement(), 'height')).to.equal('19px');
      // Check if correct document padding was added.
      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${19 + 20}px`
      );
    });

    it('should open the dialog', async () => {
      const openedDialog = await dialog.open();
      expect(openedDialog.getContainer().tagName).to.equal('SWG-CONTAINER');

      // Should have top level friendly iframe created.
      const iframe = openedDialog.getElement();
      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframe.nodeName).to.equal('IFRAME');

      // Should have document loaded.
      const iframeDoc = openedDialog.getIframe().getDocument();
      expect(iframeDoc.nodeType).to.equal(9);
      expect(iframeDoc.nodeName).to.equal('#document');

      // Should have container created.
      const container = openedDialog.getContainer();
      expect(container.nodeType).to.equal(1);
      expect(container.nodeName).to.equal('SWG-CONTAINER');
    });

    it('should throw if container is missing', async () => {
      expect(() => dialog.getContainer()).to.throw('not opened yet');
    });

    it('should remove the dialog', async () => {
      const openedDialog = await dialog.open();
      expect(openedDialog.getContainer().tagName).to.equal('SWG-CONTAINER');

      // Should have top level friendly iframe created.
      const iframe = openedDialog.getElement();
      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframe.nodeName).to.equal('IFRAME');
      expect(doc.querySelector('iframe')).to.equal(iframe);
      expect(openedDialog.getIframe().isConnected()).to.equal(true);

      // Remove the element from the dom.
      await dialog.close(NO_ANIMATE);

      expect(doc.querySelector('iframe')).to.be.null;
      expect(openedDialog.getIframe().isConnected()).to.equal(false);

      // Check if document padding was removed.
      expect(win.document.documentElement.style.paddingBottom).to.equal('');
      expect(graypaneStubs.destroy).to.be.calledOnce;
      expect(graypaneStubs.hide).to.not.be.called;
    });

    it('should remove the dialog with animation', async () => {
      immediate();
      await dialog.open();
      await dialog.close(ANIMATE);
      expect(win.document.documentElement.contains(dialog.getElement())).to.be
        .false;
      // Check if document padding was removed.
      expect(win.document.documentElement.style.paddingBottom).to.equal('');
      expect(graypaneStubs.destroy).to.be.calledOnce;
      expect(graypaneStubs.hide).to.be.calledOnce.calledWith(ANIMATE);
    });

    it('should throw if iframe already connected', async () => {
      immediate();
      sandbox.stub(dialog.iframe_, 'isConnected').returns(true);
      expect(() => dialog.open()).to.throw('already opened');
    });

    it('should have Loading view element added', async () => {
      const openedDialog = await dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const loadingView = iframeDoc.querySelector('swg-loading');
      expect(loadingView.nodeName).to.equal('SWG-LOADING');

      expect(loadingView.children.length).to.equal(1);
    });

    it('should display loading view', async () => {
      const openedDialog = await dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const loadingContainer = iframeDoc.querySelector('swg-loading-container');

      let styleDuringInit;
      view.init = () => {
        styleDuringInit = loadingContainer.getAttribute('style');
        return Promise.resolve(dialog);
      };
      view.hasLoadingIndicator = () => true;

      await openedDialog.openView(view);
      expect(styleDuringInit).to.equal('');
      expect(loadingContainer.getAttribute('style')).to.equal(
        'display: none !important;'
      );
    });

    it('should not display loading view if previous view did', async () => {
      const openedDialog = await dialog.open();
      view.hasLoadingIndicator = () => {
        return true;
      };
      await openedDialog.openView(view);
      const view2 = {
        getElement: () => element,
        init: (dialog) => Promise.resolve(dialog),
        resized: () => {},
        shouldFadeBody: () => true,
        hasLoadingIndicator: () => false,
      };
      let styleDuringInit;
      view2.init = () => {
        styleDuringInit = openedDialog
          .getIframe()
          .getDocument()
          .querySelector('swg-loading-container')
          .getAttribute('style');
        return Promise.resolve(dialog);
      };

      await openedDialog.openView(view2);
      expect(styleDuringInit).to.equal('display: none !important;');
    });
  });
});
