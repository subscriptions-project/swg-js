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
import {Graypane} from './graypane';
import {LoadingView} from '../ui/loading-view';
import {
  createElement,
  injectStyleSheet,
  removeChildren,
} from '../utils/dom';
import {
  setStyles,
  setImportantStyles,
} from '../utils/style';
import {transition} from '../utils/animation';
import {FriendlyIframe} from './friendly-iframe';

const Z_INDEX = 2147483647;

/**
 * Default iframe important styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
 * @const {!Object<string, string|number>}
 */
const rootElementImportantStyles = {
  'min-height': '50px',
  'opacity': 1,
  'border': 'none',
  'display': 'block',
  'background-color': 'rgb(255, 255, 255)',
  'position': 'fixed',
  'z-index': Z_INDEX,
  'box-shadow':
      'rgba(60, 64, 67, .3) 0 1px 1px, rgba(60, 64, 67, .15) 0 1px 4px 1px',
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
 * Position of the dialog.
 * @const @enum {string}
 */
const PositionAt = {
  BOTTOM: 'BOTTOM',
  TOP: 'TOP',
  FLOAT: 'FLOAT',
  FULL: 'FULL',
};


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
   */
  constructor(doc, importantStyles = {}, styles = {}) {
    /** @private @const {!../model/doc.Doc} */
    this.doc_ = doc;

    /** @private @const {!FriendlyIframe} */
    this.iframe_ = new FriendlyIframe(
        doc.getWin().document, {'class': 'swg-dialog'});

    /** @private @const {!Graypane} */
    this.graypane_ = new Graypane(doc, Z_INDEX - 1);

    const modifiedImportantStyles =
        Object.assign({}, rootElementImportantStyles, importantStyles);
    setImportantStyles(
        this.iframe_.getElement(), modifiedImportantStyles);

    setStyles(this.iframe_.getElement(), styles);

    /** @private {LoadingView} */
    this.loadingView_ = null;

    /** @private {?Element} */
    this.container_ = null;  // Depends on constructed document inside iframe.

    /** @private {?./view.View} */
    this.view_ = null;

    /** @private {?Promise} */
    this.animating_ = null;
  }

  /**
   * Opens the dialog and builds the iframe container.
   * @param {boolean=} animated
   * @return {!Promise<!Dialog>}
   */
  open(animated = true) {
    const iframe = this.iframe_;
    if (iframe.isConnected()) {
      throw new Error('already opened');
    }

    // Attach.
    this.doc_.getBody().appendChild(iframe.getElement());  // Fires onload.
    this.graypane_.attach();

    if (animated) {
      this.animate_(() => {
        setImportantStyles(iframe.getElement(), {
          'transform': 'translateY(100%)',
        });
        return transition(iframe.getElement(), {
          'transform': 'translateY(0)',
        }, 300, 'ease-out');
      });
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
    injectStyleSheet(iframeDoc, DIALOG_CSS);

    // Add Loading indicator.
    this.loadingView_ = new LoadingView(iframeDoc);
    iframeBody.appendChild(this.loadingView_.getElement());

    // Container for all dynamic content, including 3P iframe.
    this.container_ =
        createElement(iframeDoc, 'div', {'class': 'swg-container'});
    iframeBody.appendChild(this.container_);
    this.setPosition_();
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
        return transition(this.getElement(), {
          'transform': 'translateY(100%)',
        }, 300, 'ease-out');
      });
    } else {
      animating = Promise.resolve();
    }
    return animating.then(() => {
      this.doc_.getBody().removeChild(this.iframe_.getElement());
      this.removePaddingToHtml_();
      this.graypane_.destroy();
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
   * Whether to display loading indicator.
   * @param {boolean} isLoading
   */
  setLoading(isLoading) {
    if (isLoading) {
      this.loadingView_.show();
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
    if (this.view_) {
      // TODO(dparikh): Maybe I need to keep it until the new one is ready.
      removeChildren(this.getContainer());
    }
    this.view_ = view;

    setImportantStyles(view.getElement(), resetViewStyles);
    this.setLoading(true);
    this.getContainer().appendChild(view.getElement());

    // If the current view should fade the parent document.
    if (view.shouldFadeBody()) {
      this.graypane_.show(/* animate */ true);
    }
    return view.init(this).then(() => {
      setImportantStyles(view.getElement(), {
        'opacity': 1,
      });
      this.setLoading(false);
    });
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

    let animating;
    if (animated) {
      const oldHeight = this.getElement().offsetHeight;
      if (newHeight >= oldHeight) {
        // Expand.
        animating = this.animate_(() => {
          setImportantStyles(this.getElement(), {
            'height': `${newHeight}px`,
            'transform': `translateY(${newHeight - oldHeight}px)`,
          });
          return transition(this.getElement(), {
            'transform': 'translateY(0)',
          }, 300, 'ease-out');
        });
      } else {
        // Collapse.
        animating = this.animate_(() => {
          return transition(this.getElement(), {
            'transform': `translateY(${oldHeight - newHeight}px)`,
          }, 300, 'ease-out').then(() => {
            setImportantStyles(this.getElement(), {
              'height': `${newHeight}px`,
              'transform': 'translateY(0)',
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
    return this.animating_ = wait.then(() => {
      return callback();
    }, () => {
      // Ignore errors to make sure animations don't get stuck.
    }).then(() => {
      this.animating_ = null;
    });
  }

  /**
   * Returns maximum allowed height for current viewport.
   * @param {number} height
   * @return {number}
   * @private
   */
  getMaxAllowedHeight_(height) {
    return Math.min(height, this.doc_.getWin()./*OK*/innerHeight * 0.9);
  }

  /**
   * Gets the element's height.
   * @return {number}
   * @private
   */
  getHeight_() {
    return this.getElement().offsetHeight;
  }

  /**
   * Sets the position of the dialog. Currently 'BOTTOM' is set by default.
   */
  setPosition_() {
    setImportantStyles(this.getElement(), this.getPositionStyle_());
  }

  /**
   * Add the padding to the containing page so as to not hide the content
   * behind the popup, if rendered at the bottom.
   * @param {number} newHeight
   * @private
   */
  updatePaddingToHtml_(newHeight) {
    if (this.inferPosition_() == PositionAt.BOTTOM) {
      const bottomPadding = newHeight + 20;  // Add some extra padding.
      const htmlElement = this.doc_.getRootElement();
      setImportantStyles(htmlElement, {
        'padding-bottom': `${bottomPadding}px`,
      });
    }
  }

  /**
   * Removes previouly added bottom padding from the document.
   * @private`
   */
  removePaddingToHtml_() {
    this.doc_.getRootElement().style.removeProperty('padding-bottom');
  }


  /**
   * Calculates the position of the dialog. Currently dialog is positioned at
   * the bottom only. This could change in future to adjust the dialog position
   * based on the screen size.
   * @return {string}
   * @private
   */
  inferPosition_() {
    return PositionAt.BOTTOM;
  }

  /**
   * Returns the styles required to postion the dialog.
   * @return {!Object<string, string|number>}
   * @private
   */
  getPositionStyle_() {
    const dialogPosition = this.inferPosition_();
    switch (dialogPosition) {
      case PositionAt.BOTTOM:
        return {'bottom': 0};
      case PositionAt.TOP:
        return {'top': 0};
      case PositionAt.FLOAT:
        return {
          'position': 'fixed',
          'top': '50%',
          'left': '50%',
          'transform': 'translate(-50%, -50%)',
        };
      case PositionAt.FULL:
        return {
          'position': 'fixed',
          'height': '100%',
          'top': 0,
          'bottom': 0,
        };
      default:
        return {'bottom': 0};
    }
  }
}
