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

import {CSS as DIALOG_CSS} from '../../build/css/ui/ui.css';
import {FriendlyIframe} from './friendly-iframe';
import {Graypane} from './graypane';
import {LoadingView} from '../ui/loading-view';
import {
  createElement,
  injectStyleSheet,
  removeChildren,
  removeElement,
} from '../utils/dom';
import {resolveDoc} from '../model/doc';
import {setImportantStyles, setStyles} from '../utils/style';
import {transition} from '../utils/animation';

const Z_INDEX = 2147483647;

/**
 * Default iframe important styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
 * @const {!Object<string, string|number>}
 */
const rootElementImportantStyles = {
  'min-height': '50px',
  'border': 'none',
  'display': 'block',
  'position': 'fixed',
  'z-index': Z_INDEX,
  'box-sizing': 'border-box',
};

/**
 * Reset view styles.
 * @const {!Object<string, string|number>}
 */
const resetViewStyles = {
  'position': 'absolute',
  'top': '0',
  'left': '0',
  'right': '0',
  'bottom': '0',
  'opacity': 0,
  /* These lines are a work around to this issue in iOS:     */
  /* https://bugs.webkit.org/show_bug.cgi?id=155198          */
  'height': 0,
  'max-height': '100%',
  'max-width': '100%',
  'min-height': '100%',
  'min-width': '100%',
  'width': 0,
};

/**
 * Display configration options for dialogs.
 *
 * Properties:
 * - desktopConfig: Options for dialogs on desktop screens.
 *
 * @typedef {{
 *   desktopConfig: (DesktopDialogConfig|undefined),
 * }}
 */
export let DialogConfig;

/**
 * Display configuration options for dialogs on desktop screens.
 *
 * Properties:
 * - isCenterPositioned: Whether the dialog should be positioned at the center
 *       of the viewport rather than at the bottom on desktop screens.
 * - supportsWideScreen: Whether the dialog supports a 808px width on viewports
 *       that are >= 870px wide.
 *
 * @typedef {{
 *   isCenterPositioned: (boolean|undefined),
 *   supportsWideScreen: (boolean|undefined),
 * }}
 */
export let DesktopDialogConfig;

/**
 * The class for the top level dialog.
 * @final
 */
export class Dialog {
  /**
   * Create a dialog for the provided doc.
   * @param {!../model/doc.Doc} doc
   * @param {!Object<string, string|number>=} importantStyles
   * @param {!Object<string, string|number>=} styles
   * @param {!DialogConfig=} dialogConfig Configuration options for the dialog.
   */
  constructor(doc, importantStyles = {}, styles = {}, dialogConfig = {}) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;

    const desktopDialogConfig = dialogConfig.desktopConfig || {};
    const supportsWideScreen = !!desktopDialogConfig.supportsWideScreen;

    /** @private @const {!FriendlyIframe} */
    this.iframe_ = new FriendlyIframe(doc.getWin().document, {
      'class': `swg-dialog ${supportsWideScreen ? 'swg-wide-dialog' : ''}`,
    });

    /** @private @const {!Graypane} */
    this.graypane_ = new Graypane(doc, Z_INDEX - 1);

    const modifiedImportantStyles = Object.assign(
      {},
      rootElementImportantStyles,
      importantStyles
    );
    setImportantStyles(this.iframe_.getElement(), modifiedImportantStyles);

    setStyles(this.iframe_.getElement(), styles);

    /** @private {LoadingView} */
    this.loadingView_ = null;

    /** @private {?Element} */
    this.container_ = null; // Depends on constructed document inside iframe.

    /** @private {?./view.View} */
    this.view_ = null;

    /** @private {?Promise} */
    this.animating_ = null;

    /**
     * Helps identify stale animations.
     * @private {number}
     */
    this.animationNumber_ = 0;

    /** @private {boolean} */
    this.hidden_ = false;

    /** @private {?./view.View} */
    this.previousProgressView_ = null;

    /** @private {number} */
    this.maxAllowedHeightRatio_ = 0.9;

    /** @const @private {boolean} */
    this.positionCenterOnDesktop_ = !!desktopDialogConfig.isCenterPositioned;

    /** @const @private {!MediaQueryList} */
    this.desktopMediaQuery_ = this.doc_
      .getWin()
      .matchMedia('(min-width: 641px)');

    /**
     * Reference to the listener that acts on changes to desktopMediaQuery.
     * @private {?function()}
     */
    this.desktopMediaQueryListener_ = null;
  }

  /**
   * Opens the dialog and builds the iframe container.
   * @param {boolean=} hidden
   * @return {!Promise<!Dialog>}
   */
  open(hidden = false) {
    const iframe = this.iframe_;
    if (iframe.isConnected()) {
      throw new Error('already opened');
    }

    // Attach.
    this.doc_.getBody().appendChild(iframe.getElement()); // Fires onload.

    this.graypane_.attach();

    if (hidden) {
      setImportantStyles(iframe.getElement(), {
        'visibility': 'hidden',
        'opacity': 0,
      });
      this.hidden_ = hidden;
    } else {
      this.show_();
    }

    return iframe.whenReady().then(() => {
      this.buildIframe_();
      return this;
    });
  }

  /**
   * Build the iframe with the styling after iframe is loaded.
   * @private
   */
  buildIframe_() {
    const iframe = this.iframe_;
    const iframeBody = iframe.getBody();
    const iframeDoc = /** @type {!HTMLDocument} */ (this.iframe_.getDocument());

    // Inject Google fonts in <HEAD> section of the iframe.
    injectStyleSheet(resolveDoc(iframeDoc), DIALOG_CSS);

    // Add Loading indicator.
    this.loadingView_ = new LoadingView(iframeDoc);
    iframeBody.appendChild(this.loadingView_.getElement());

    // Container for all dynamic content, including 3P iframe.
    this.container_ = createElement(iframeDoc, 'swg-container', {});
    iframeBody.appendChild(this.container_);
    this.setPosition_();

    // Add listener to adjust position when crossing a media query breakpoint.
    if (this.positionCenterOnDesktop_) {
      this.desktopMediaQueryListener_ = () => {
        this.setPosition_();
      };
      this.desktopMediaQuery_.addListener(this.desktopMediaQueryListener_);
    }
  }

  /**
   * Closes the dialog.
   * @param {boolean=} animated
   * @return {!Promise}
   */
  close(animated = true) {
    let animating;
    if (animated) {
      animating = this.animate_(() => {
        this.graypane_.hide(/* animate */ true);
        return transition(
          this.getElement(),
          {
            'transform': 'translateY(100%)',
          },
          300,
          'ease-out'
        );
      });
    } else {
      animating = Promise.resolve();
    }
    return animating.then(() => {
      const iframeEl = this.iframe_.getElement();
      iframeEl.parentNode.removeChild(iframeEl);

      this.removePaddingToHtml_();
      this.graypane_.destroy();
      if (this.desktopMediaQueryListener_) {
        this.desktopMediaQuery_.removeListener(this.desktopMediaQueryListener_);
      }
    });
  }

  /**
   * Gets the container within the dialog.
   * @return {!Element}
   */
  getContainer() {
    if (!this.container_) {
      throw new Error('not opened yet');
    }
    return this.container_;
  }

  /**
   * Gets the attached iframe instance.
   * @return {!FriendlyIframe}
   */
  getIframe() {
    return this.iframe_;
  }

  /**
   * Gets the Iframe element.
   * @return {!HTMLIFrameElement}
   */
  getElement() {
    return this.iframe_.getElement();
  }

  /**
   * Gets the LoadingView for this dialog.
   * @return {LoadingView}
   */
  getLoadingView() {
    return this.loadingView_;
  }

  /**
   * Returns whether the dialog is center-positioned on desktop screens.
   * @return {boolean}
   */
  isPositionCenterOnDesktop() {
    return this.positionCenterOnDesktop_;
  }

  /**
   * Transitions to the next view.
   * @private
   */
  entryTransitionToNextView_() {
    if (this.view_ && this.view_.hasLoadingIndicator()) {
      // Temporarily cache the old view.
      this.previousProgressView_ = this.view_;
    } else {
      // Since loading indicator will be shown, remove contents of old view.
      removeChildren(this.getContainer());
      // When loading indicator was not displayed in the previous view,
      // loading indicator must be displayed while transitioning to new view.
      this.loadingView_.show();
    }
  }

  /**
   * Transition out of an old view.
   * @private
   */
  exitTransitionFromOldView_() {
    // If previous view is still around, remove it.
    if (this.previousProgressView_) {
      removeElement(this.previousProgressView_.getElement());
      this.previousProgressView_ = null;
    } else {
      this.loadingView_.hide();
    }
  }

  /** @return {?./view.View} */
  getCurrentView() {
    return this.view_;
  }

  /**
   * Opens the given view and removes existing view from the DOM if any.
   * @param {!./view.View} view
   * @return {!Promise}
   */
  openView(view) {
    setImportantStyles(view.getElement(), resetViewStyles);
    this.entryTransitionToNextView_();

    this.view_ = view;
    this.getContainer().appendChild(view.getElement());

    // If the current view should fade the parent document.
    if (view.shouldFadeBody() && !this.hidden_) {
      this.graypane_.show(/* animate */ true);
    }

    return view.init(this).then(() => {
      setImportantStyles(view.getElement(), {
        'opacity': 1,
      });
      if (this.hidden_) {
        if (view.shouldFadeBody()) {
          this.graypane_.show(/* animated */ true);
        }
        this.show_();
      }
      this.exitTransitionFromOldView_();
    });
  }

  /**
   * Show the iframe.
   * @private
   */
  show_() {
    this.animate_(() => {
      setImportantStyles(this.getElement(), {
        'transform': 'translateY(100%)',
        'opactiy': 1,
        'visibility': 'visible',
      });
      return transition(
        this.getElement(),
        {
          'transform': this.getDefaultTranslateY_(),
          'opacity': 1,
          'visibility': 'visible',
        },
        300,
        'ease-out'
      );
    });
    this.hidden_ = false;
  }

  /**
   * Resizes the dialog container.
   * @param {!./view.View} view
   * @param {number} height
   * @param {boolean=} animated
   * @return {?Promise}
   */
  resizeView(view, height, animated = true) {
    if (this.view_ != view) {
      return null;
    }
    const newHeight = this.getMaxAllowedHeight_(height);

    // Uniquely identify this animation.
    // This lets callbacks abandon stale animations.
    const animationNumber = ++this.animationNumber_;
    const isStale = () => {
      return animationNumber !== this.animationNumber_;
    };

    let animating;
    if (animated) {
      const oldHeight = this.getElement().offsetHeight;
      if (newHeight >= oldHeight) {
        // Expand.
        animating = this.animate_(() => {
          if (isStale()) {
            return Promise.resolve();
          }

          setImportantStyles(this.getElement(), {
            'height': `${newHeight}px`,
            'transform': `translateY(${newHeight - oldHeight}px)`,
          });
          return transition(
            this.getElement(),
            {
              'transform': this.getDefaultTranslateY_(),
            },
            300,
            'ease-out'
          );
        });
      } else {
        // Collapse.
        animating = this.animate_(() => {
          const transitionPromise = isStale()
            ? Promise.resolve()
            : transition(
                this.getElement(),
                {
                  'transform': `translateY(${oldHeight - newHeight}px)`,
                },
                300,
                'ease-out'
              );
          return transitionPromise.then(() => {
            if (isStale()) {
              return;
            }

            setImportantStyles(this.getElement(), {
              'height': `${newHeight}px`,
              'transform': this.getDefaultTranslateY_(),
            });
          });
        });
      }
    } else {
      setImportantStyles(this.getElement(), {
        'height': `${newHeight}px`,
      });
      animating = Promise.resolve();
    }
    return animating.then(() => {
      if (isStale()) {
        return;
      }

      this.updatePaddingToHtml_(height);
      view.resized();
    });
  }

  /**
   * @param {function():!Promise} callback
   * @return {!Promise}
   * @private
   */
  animate_(callback) {
    const wait = this.animating_ || Promise.resolve();
    return (this.animating_ = wait
      .then(
        () => {
          return callback();
        },
        () => {
          // Ignore errors to make sure animations don't get stuck.
        }
      )
      .then(() => {
        this.animating_ = null;
      }));
  }

  /**
   * Returns maximum allowed height for current viewport.
   * @param {number} height
   * @return {number}
   * @private
   */
  getMaxAllowedHeight_(height) {
    return Math.min(
      height,
      this.doc_.getWin()./*OK*/ innerHeight * this.maxAllowedHeightRatio_
    );
  }

  /**
   * Sets the max allowed height as a ratio to the viewport height. For example,
   * ratio = 0.9 means the max allowed height is 90% of the viewport height.
   * @param {number} ratio
   */
  setMaxAllowedHeightRatio(ratio) {
    this.maxAllowedHeightRatio_ = ratio;
  }

  /**
   * Add the padding to the containing page so as to not hide the content
   * behind the popup, if rendered at the bottom.
   * @param {number} newHeight
   * @private
   */
  updatePaddingToHtml_(newHeight) {
    const bottomPadding = newHeight + 20; // Add some extra padding.
    const htmlElement = this.doc_.getRootElement();
    setImportantStyles(htmlElement, {
      'padding-bottom': `${bottomPadding}px`,
    });
  }

  /**
   * Removes previouly added bottom padding from the document.
   * @private
   */
  removePaddingToHtml_() {
    this.doc_.getRootElement().style.removeProperty('padding-bottom');
  }

  /**
   * Sets the position of the dialog. Currently only supports 'BOTTOM', with
   * an option of switching to 'CENTER' on desktop screens.
   */
  setPosition_() {
    setImportantStyles(this.getElement(), this.getPositionStyle_());
  }

  /**
   * Returns the styles required to postion the dialog.
   * @return {!Object<string, string|number>}
   * @private
   */
  getPositionStyle_() {
    if (this.positionCenterOnDesktop_ && this.desktopMediaQuery_.matches) {
      return {
        'top': '50%',
        'bottom': 0,
        'transform': this.getDefaultTranslateY_(),
      };
    }
    return {
      'top': 'auto',
      'bottom': 0,
      'transform': this.getDefaultTranslateY_(),
    };
  }

  /**
   * Returns default translateY style for the dialog.
   * @return {string}
   * @private
   */
  getDefaultTranslateY_() {
    if (this.positionCenterOnDesktop_ && this.desktopMediaQuery_.matches) {
      return 'translateY(-50%)';
    }
    return 'translateY(0px)';
  }
}
