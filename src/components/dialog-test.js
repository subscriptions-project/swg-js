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

import {ArticleExperimentFlags} from '../runtime/experiment-flags';
import {Dialog} from './dialog';
import {GlobalDoc} from '../model/doc';
import {getStyle} from '../utils/style';
import {setExperimentsStringForTesting} from '../runtime/experiments';

const NO_ANIMATE = false;
const ANIMATE = true;
const HIDDEN = true;

describes.realWin('Dialog', (env) => {
  let win;
  let doc;
  let dialog;
  let globalDoc;
  let graypaneStubs;
  let view;
  let element;
  let lastMessage;
  const documentHeight = 100;

  beforeEach(() => {
    lastMessage = null;
    win = env.win;
    doc = env.win.document;
    globalDoc = new GlobalDoc(win);

    element = doc.createElement('div');
    element.contentWindow = {postMessage: (message) => (lastMessage = message)};
    view = {
      getElement: () => element,
      init: (dialog) => Promise.resolve(dialog),
      resized: () => {},
      shouldFadeBody: () => true,
      shouldAnimateFade: () => true,
    };

    sandbox.stub(self, 'requestAnimationFrame').callsFake((callback) => {
      callback();
    });
  });

  /** Updates `setTimeout` to immediately call its callback. */
  function immediate() {
    win.setTimeout = (callback) => callback();
  }

  describe('dialog', () => {
    beforeEach(() => {
      dialog = new Dialog(globalDoc, {height: `${documentHeight}px`});
      graypaneStubs = sandbox.stub(dialog.graypane_);
    });

    it('should have created a friendly iframe instance', async () => {
      const iframe = dialog.getElement();
      expect(iframe.nodeType).to.equal(1);
      expect(iframe.nodeName).to.equal('IFRAME');

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
      expect(getStyle(iframe, 'display')).to.equal('block');
    });

    it('should have created fade background with animation', async () => {
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

    it('should have created fade background with no animation', async () => {
      view.shouldAnimateFade = () => false;

      expect(graypaneStubs.attach).to.not.be.called;
      const openedDialog = await dialog.open(NO_ANIMATE);
      expect(graypaneStubs.attach).to.be.calledOnce;
      expect(graypaneStubs.show).to.not.be.called;

      await openedDialog.openView(view);
      expect(graypaneStubs.show).to.be.calledOnce.calledWith(NO_ANIMATE);
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
      expect(win.getComputedStyle(element)['opacity']).to.equal('1');
      expect(win.getComputedStyle(element)['max-height']).to.equal('100%');
      expect(win.getComputedStyle(element)['max-width']).to.equal('100%');
      expect(win.getComputedStyle(element)['min-height']).to.equal('100%');
      expect(win.getComputedStyle(element)['min-width']).to.equal('100%');
      expect(win.getComputedStyle(element)['height']).to.match(/px$/g);
      expect(win.getComputedStyle(element)['width']).to.match(/px$/g);
      expect(graypaneStubs.show).to.be.calledOnce.calledWith(ANIMATE);
    });

    it('should build the view and show hidden iframe', async () => {
      const openedDialog = await dialog.open(HIDDEN);
      await openedDialog.openView(view);
      expect(win.getComputedStyle(element)['visibility']).to.equal('visible');
      expect(win.getComputedStyle(element)['opacity']).to.equal('1');
      expect(win.getComputedStyle(element)['max-height']).to.equal('100%');
      expect(win.getComputedStyle(element)['max-width']).to.equal('100%');
      expect(win.getComputedStyle(element)['min-height']).to.equal('100%');
      expect(win.getComputedStyle(element)['min-width']).to.equal('100%');
      expect(win.getComputedStyle(element)['height']).to.match(/px$/g);
      expect(win.getComputedStyle(element)['width']).to.match(/px$/g);
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
          parseFloat(win.getComputedStyle(dialog.getElement())['height'])
        ) + 'px';
      expect(measuredDialogHeight).to.equal(`${expectedDialogHeight}px`);

      // Check if correct document padding was added.
      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${expectedDialogHeight + 20}px`
      );
    });

    it('should return null if passed wrong view', async () => {
      const wrongView = {};
      expect(await dialog.resizeView(wrongView)).to.be.null;
    });

    it('resizes the element to expand with an animation', async () => {
      const newHeight = 110;

      immediate();
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(setStylePropertySpy).to.be.callCount(5);
      // Verify intermediate translate value was set.
      expect(setStylePropertySpy).to.have.been.calledWith(
        'transform',
        'translateY(10px)'
      );
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

    it('resizes the element to collapse with animation', async () => {
      const newHeight = 90;

      immediate();
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(setStylePropertySpy).to.be.callCount(5);
      // Verify intermediate translate value was set.
      expect(setStylePropertySpy).to.have.been.calledWith(
        'transform',
        'translateY(10px)'
      );
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

    it('cancels stale expansion animations', async () => {
      const newHeight1 = 111;
      const newHeight2 = 112;

      immediate();
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      dialog.resizeView(view, newHeight1, ANIMATE);
      await dialog.resizeView(view, newHeight2, ANIMATE);

      expect(setStylePropertySpy).to.be.callCount(5);
      expect(getStyle(dialog.getElement(), 'height')).to.equal(
        `${newHeight2}px`
      );
    });

    it('cancels stale collapse animations', async () => {
      const newHeight1 = 90;
      const newHeight2 = 89;

      immediate();
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      dialog.resizeView(view, newHeight1, ANIMATE);
      await dialog.resizeView(view, newHeight2, ANIMATE);

      expect(setStylePropertySpy).to.be.callCount(5);
      expect(getStyle(dialog.getElement(), 'height')).to.equal(
        `${newHeight2}px`
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

    it('focuses the iframe contents after dialog is opened', async () => {
      immediate();
      await dialog.open();
      expect(doc.activeElement).to.equal(dialog.getElement());
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

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.open();
      await dialog.close(ANIMATE);

      expect(win.document.documentElement.contains(dialog.getElement())).to.be
        .false;
      // Check if document padding was removed.
      expect(win.document.documentElement.style.paddingBottom).to.equal('');
      expect(graypaneStubs.destroy).to.be.calledOnce;
      expect(graypaneStubs.hide).to.be.calledOnce.calledWith(ANIMATE);

      expect(setStylePropertySpy).to.have.been.calledWith(
        'transform',
        'translateY(100%)'
      );
    });

    it('throws if iframe already connected', async () => {
      immediate();
      sandbox.stub(dialog.iframe_, 'isConnected').returns(true);
      await expect(dialog.open()).to.eventually.be.rejectedWith(
        'already opened'
      );
    });

    it('should have Loading view element added', async () => {
      const openedDialog = await dialog.open();
      const iframeDoc = openedDialog.getIframe().getDocument();
      const loadingView = iframeDoc.querySelector('swg-loading');
      expect(loadingView.nodeName).to.equal('SWG-LOADING');

      expect(loadingView.children.length).to.equal(1);
    });

    it('omits centered-on-desktop on LoadingView by default', async () => {
      const openedDialog = await dialog.open();
      const loadingContainer = openedDialog
        .getIframe()
        .getDocument()
        .querySelector('swg-loading-container');
      expect(loadingContainer).to.not.have.class('centered-on-desktop');
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
        resized: () => {},
        shouldFadeBody: () => true,
        shouldAnimateFade: () => false,
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

    describe('fade background experiment disabled', () => {
      beforeEach(() => {
        setExperimentsStringForTesting('');
      });

      it('should not suppress click events or close window when true', async () => {
        let wasClicked = false;
        const clickFun = function () {
          wasClicked = true;
        };
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: true, shouldDisableBodyScrolling: true}
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        doc.body.addEventListener('click', clickFun);
        // This class is added when the screen is opened.
        expect(doc.body).to.have.class('swg-disable-scroll');

        el.click();

        expect(doc.body).to.have.class('swg-disable-scroll');
        expect(wasClicked).to.be.true;
      });

      it('should not suppress click events or close window when false', async () => {
        let wasClicked = false;
        const clickFun = function () {
          wasClicked = true;
        };
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: false, shouldDisableBodyScrolling: true}
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        doc.body.addEventListener('click', clickFun);
        // This class is added when the screen is opened.
        expect(doc.body).to.have.class('swg-disable-scroll');

        el.click();

        expect(doc.body).to.have.class('swg-disable-scroll');
        expect(wasClicked).to.be.true;
      });
    });

    describe('fade background experiment enabled', () => {
      beforeEach(() => {
        setExperimentsStringForTesting(
          ArticleExperimentFlags.BACKGROUND_CLICK_BEHAVIOR_EXPERIMENT
        );
      });

      it('should not suppress click events by default', async () => {
        let wasClicked = false;
        const clickFun = function () {
          wasClicked = true;
        };
        dialog = new Dialog(
          globalDoc,
          undefined,
          undefined,
          undefined,
          Promise.resolve(true)
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        doc.body.addEventListener('click', clickFun);
        el.click();

        expect(wasClicked).to.be.true;
      });

      it('should suppress event bubbling if not closable', async () => {
        let wasClicked = false;
        const clickFun = function () {
          wasClicked = true;
        };
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: false},
          Promise.resolve(true)
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        doc.body.addEventListener('click', clickFun);
        el.click();

        expect(wasClicked).to.be.false;
      });

      it('should suppress event bubbling if closable', async () => {
        let wasClicked = false;
        const clickFun = function () {
          wasClicked = true;
        };
        dialog = new Dialog(
          globalDoc,

          {},
          {},
          {closeOnBackgroundClick: true},
          Promise.resolve(true)
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        doc.body.addEventListener('click', clickFun);
        el.click();

        expect(wasClicked).to.be.false;
      });

      it('respects not closable', async () => {
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: false, shouldDisableBodyScrolling: true},
          Promise.resolve(true)
        );
        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);
        // This class is added when the screen is opened.
        expect(lastMessage).to.equal(null);

        el.click();

        expect(lastMessage).to.equal(null);
      });

      it('respects closable', async () => {
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: true, shouldDisableBodyScrolling: true},
          Promise.resolve(true)
        );

        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);

        expect(lastMessage).to.equal(null);

        await el.click();

        //swg-js is expected to post a message of 'close' to the iframe's
        //contentWindow. Boq listens for the message and then clicks the close
        //button so it can handle logging.
        expect(lastMessage).to.equal('close');
      });

      it('respects closable with domain', async () => {
        element.src = 'http://www.test.com';
        dialog = new Dialog(
          globalDoc,
          {},
          {},
          {closeOnBackgroundClick: true, shouldDisableBodyScrolling: true},
          Promise.resolve(true)
        );

        const el = dialog.graypane_.getElement();
        const openedDialog = await dialog.open(NO_ANIMATE);
        await openedDialog.openView(view);

        expect(lastMessage).to.equal(null);

        await el.click();

        //swg-js is expected to post a message of 'close' to the iframe's
        //contentWindow. Boq listens for the message and then clicks the close
        //button so it can handle logging.
        expect(lastMessage).to.equal('close');

        element.src = null;
      });
    });

    describe('body scrolling disabled', () => {
      describe('openView', () => {
        it('adds swg-disable-scroll class if config specifies scrolling should be disabled', async () => {
          dialog = new Dialog(
            globalDoc,
            /* importantStyles */ {},
            /* styles */ {},
            {shouldDisableBodyScrolling: true}
          );
          await dialog.open();
          view.shouldDisableBodyScrolling = () => true;
          await dialog.openView(view);
          expect(doc.body).to.have.class('swg-disable-scroll');
        });

        it('does not add swg-disable-scroll otherwise', async () => {
          dialog = new Dialog(
            globalDoc,
            /* importantStyles */ {},
            /* styles */ {},
            {shouldDisableBodyScrolling: false}
          );
          await dialog.open();
          view.shouldDisableBodyScrolling = () => false;
          await dialog.openView(view);
          expect(doc.body).not.to.have.class('swg-disable-scroll');
        });
      });

      describe('close', () => {
        it('removes swg-disable-scroll class', async () => {
          dialog = new Dialog(
            globalDoc,
            /* importantStyles */ {},
            /* styles */ {},
            {shouldDisableBodyScrolling: true}
          );
          await dialog.open();
          view.shouldDisableBodyScrolling = () => true;
          await dialog.openView(view);
          expect(doc.body).to.have.class('swg-disable-scroll');
          await dialog.close();
          expect(doc.body).not.to.have.class('swg-disable-scroll');
        });
      });
    });
  });

  describe('dialog with maxAllowedHeightRatio', () => {
    const MAX_ALLOWED_HEIGHT_RATIO = 0.5;

    beforeEach(() => {
      dialog = new Dialog(
        globalDoc,
        {height: `${documentHeight}px`},
        /* styles */ {},
        {maxAllowedHeightRatio: MAX_ALLOWED_HEIGHT_RATIO}
      );
    });

    it('resizes based on the maxAllowedHeightRatio', async () => {
      const openedDialog = await dialog.open();
      await openedDialog.openView(view);

      const viewportHeight = globalDoc.getWin().innerHeight;
      // Resize view to a height that is larger than the viewport height.
      await openedDialog.resizeView(view, viewportHeight * 2, NO_ANIMATE);

      const measuredDialogHeight =
        // Round the measured height to allow for subpixel differences
        // between browsers & environments.
        Math.round(
          parseFloat(win.getComputedStyle(dialog.getElement())['height'])
        ) + 'px';
      const expectedDialogHeight = viewportHeight * MAX_ALLOWED_HEIGHT_RATIO;
      expect(measuredDialogHeight).to.equal(`${expectedDialogHeight}px`);
    });
  });

  describe('dialog with supportsWideScreen=true', () => {
    beforeEach(() => {
      dialog = new Dialog(
        globalDoc,
        {height: `${documentHeight}px`},
        /* styles */ {},
        {desktopConfig: {supportsWideScreen: true}}
      );
    });

    it('creates iframe with swg-wide-dialog class', async () => {
      const iframe = dialog.getElement();
      expect(iframe).to.have.class('swg-dialog');
      expect(iframe).to.have.class('swg-wide-dialog');
    });
  });

  describe('dialog with iframeCssClassOverride', () => {
    const iframeCssClassOverride = 'iframe-css-class';

    beforeEach(() => {
      dialog = new Dialog(
        globalDoc,
        {height: `${documentHeight}px`},
        /* styles */ {},
        {iframeCssClassOverride}
      );
    });

    it('creates iframe with the iframe css class override', async () => {
      const iframe = dialog.getElement();
      expect(iframe).to.have.class(iframeCssClassOverride);
      expect(iframe).to.not.have.class('swg-dialog');
    });
  });

  /** @param {!HTMLIFrameElement} iframe */
  function expectPositionBottom(iframe) {
    expect(getStyle(iframe, 'top')).to.equal('auto');
    expect(getStyle(iframe, 'bottom')).to.equal('0px');
    expect(getStyle(iframe, 'transform')).to.equal('translateY(0px)');
  }

  /** @param {!HTMLIFrameElement} iframe */
  function expectPositionCenter(iframe) {
    expect(getStyle(iframe, 'top')).to.equal('50%');
    expect(getStyle(iframe, 'bottom')).to.equal('0px');
    expect(getStyle(iframe, 'transform')).to.equal('translateY(-50%)');
  }

  describe('dialog with isCenterPositioned=true on non-desktop', () => {
    let matchMedia;

    beforeEach(() => {
      matchMedia = new FakeMediaMatcher(/* matches */ false);
      sandbox.stub(win, 'matchMedia').returns(matchMedia);

      dialog = new Dialog(
        globalDoc,
        {height: `${documentHeight}px`},
        /* styles */ {},
        {desktopConfig: {isCenterPositioned: true}}
      );
    });

    it('is positioned at the bottom after open', async () => {
      immediate();
      await dialog.open();
      await dialog.animating_;

      expectPositionBottom(dialog.getElement());
    });

    it('repositions to center after window resizes to match mediaQuery', async () => {
      immediate();
      await dialog.open();
      await dialog.animating_;
      expect(matchMedia.hasListeners()).to.be.true;

      matchMedia.toggleMatches();
      matchMedia.triggerListeners();

      expectPositionCenter(dialog.getElement());
    });

    it('removes matchMedia listener on close', async () => {
      immediate();
      await dialog.open();
      await dialog.animating_;
      await dialog.close(false);

      expect(matchMedia.hasListeners()).to.be.false;
    });

    it('adds centered-on-desktop class to the LoadingView', async () => {
      immediate();
      const openedDialog = await dialog.open();
      const loadingContainer = openedDialog
        .getIframe()
        .getDocument()
        .querySelector('swg-loading-container');
      expect(loadingContainer).to.have.class('centered-on-desktop');
    });

    it('adds padding-bottom to document root on resize', async () => {
      immediate();
      await dialog.open();
      await dialog.openView(view);

      const newHeight = 110;
      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(win.document.documentElement.style.paddingBottom).to.equal(
        `${newHeight + 20}px`
      );
    });
  });

  describe('dialog with isCenterPositioned=true on desktop', () => {
    let matchMedia;

    beforeEach(() => {
      matchMedia = new FakeMediaMatcher(/* matches */ true);
      sandbox.stub(win, 'matchMedia').returns(matchMedia);

      dialog = new Dialog(
        globalDoc,
        {height: `${documentHeight}px`},
        /* styles */ {},
        {desktopConfig: {isCenterPositioned: true}}
      );
      immediate();
    });

    it('is vertically centered after open', async () => {
      await dialog.open();
      await dialog.animating_;

      expectPositionCenter(dialog.getElement());
    });

    it('repositions to bottom after window resizes to no longer match mediaQuery', async () => {
      await dialog.open();
      await dialog.animating_;
      expect(matchMedia.hasListeners()).to.be.true;

      matchMedia.toggleMatches();
      matchMedia.triggerListeners();

      expectPositionBottom(dialog.getElement());
    });

    it('removes matchMedia listener on close', async () => {
      await dialog.open();
      await dialog.animating_;
      await dialog.close(false);

      expect(matchMedia.hasListeners()).to.be.false;
    });

    it('adds centered-on-desktop class to the LoadingView', async () => {
      const openedDialog = await dialog.open();
      const loadingContainer = openedDialog
        .getIframe()
        .getDocument()
        .querySelector('swg-loading-container');
      expect(loadingContainer).to.have.class('centered-on-desktop');
    });

    it('stays vertically centered during expand animation', async () => {
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.resizeView(view, 110, ANIMATE);

      // Verify intermediate translateY for bottom dialog is not set.
      expect(setStylePropertySpy).to.not.have.been.calledWith(
        'transform',
        'translateY(10px)'
      );
    });

    it('stays vertically centered after expand animation', async () => {
      const newHeight = 110;
      await dialog.open();
      await dialog.openView(view);
      await dialog.resizeView(view, newHeight, ANIMATE);

      const iframe = dialog.getElement();
      expectPositionCenter(iframe);
      expect(getStyle(iframe, 'height')).to.equal(`${newHeight}px`);
    });

    it('stays vertically centered during collapse animation', async () => {
      await dialog.open();
      await dialog.openView(view);

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.resizeView(view, 90, ANIMATE);

      // Verify intermediate translateY for bottom dialog is not set.
      expect(setStylePropertySpy).to.not.have.been.calledWith(
        'transform',
        'translateY(10px)'
      );
    });

    it('stays vertically centered after collapse animation', async () => {
      const newHeight = 90;
      await dialog.open();
      await dialog.openView(view);
      await dialog.resizeView(view, newHeight, ANIMATE);

      const iframe = dialog.getElement();
      expectPositionCenter(iframe);
      expect(getStyle(iframe, 'height')).to.equal(`${newHeight}px`);
    });

    it('does not add padding-bottom to document root on resize', async () => {
      await dialog.open();
      await dialog.openView(view);

      const newHeight = 110;
      await dialog.resizeView(view, newHeight, ANIMATE);

      expect(win.document.documentElement.style.paddingBottom).to.equal('');
    });

    it('closes the dialog with a fade out animation', async () => {
      immediate();

      const setStylePropertySpy = sandbox
        .stub(dialog.getElement().style, 'setProperty')
        .callThrough();

      await dialog.open();
      await dialog.close(ANIMATE);

      expect(setStylePropertySpy).to.have.been.calledWith('opacity', '0');
    });
  });
});

/** Fake implementation for MediaQueryList. */
class FakeMediaMatcher {
  /** @param {boolean} matches */
  constructor(matches) {
    this.matches = matches;
    this.listeners_ = new Set();
  }

  /** @param {!Function} listener */
  addListener(listener) {
    this.listeners_.add(listener);
  }

  /** @param {!Function} listener */
  removeListener(listener) {
    this.listeners_.delete(listener);
  }

  /** @return {boolean} */
  hasListeners() {
    return !!this.listeners_.size;
  }

  triggerListeners() {
    for (const listener of this.listeners_) {
      listener();
    }
  }

  toggleMatches() {
    this.matches = !this.matches;
  }
}
