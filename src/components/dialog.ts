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

import {Doc, resolveDoc} from '../model/doc';
import {FriendlyIframe} from './friendly-iframe';
import {Graypane} from './graypane';
import {LoadingView} from '../ui/loading-view';
import {UI_CSS} from '../ui/ui-css';
import {View} from './view';
import {
  createElement,
  injectStyleSheet,
  removeChildren,
  removeElement,
} from '../utils/dom';
import {setImportantStyles, setStyles} from '../utils/style';
import {transition} from '../utils/animation';

const Z_INDEX = 2147483647;

/**
 * Default iframe important styles.
 * Note: The iframe responsiveness media query style is injected in the
 * publisher's page since style attribute can not include media query.
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
 */
const resetViewStyles = {
  'position': 'absolute',
  'top': '0',
  'left': '0',
  'right': '0',
  'bottom': '0',
  'opacity': '0',
  /* These lines are a work around to this issue in iOS:     */
  /* https://bugs.webkit.org/show_bug.cgi?id=155198          */
  'height': '0',
  'max-height': '100%',
  'max-width': '100%',
  'min-height': '100%',
  'min-width': '100%',
  'width': '0',
};

/**
 * Display configuration options for dialogs.
 *
 * Properties:
 * - desktopConfig: Options for dialogs on desktop screens.
 * - maxAllowedHeightRatio: The max allowed height of the view as a ratio of the
 *       viewport height.
 * - iframeCssClassOverride: The CSS class to use for the iframe, overriding
 *       default classes such as swg-dialog.
 * - shouldDisableBodyScrolling: Whether to disable scrolling on the content page
 *       when the dialog is visible.
 * - closeOnBackgroundClick: Whether the dialog should be dismissed if the gray
 *                           background is clicked.
 */
export interface DialogConfig {
  desktopConfig?: DesktopDialogConfig;
  maxAllowedHeightRatio?: number;
  iframeCssClassOverride?: string;
  shouldDisableBodyScrolling?: boolean;
  closeOnBackgroundClick?: boolean;
}

/**
 * Display configuration options for dialogs on desktop screens.
 *
 * Properties:
 * - isCenterPositioned: Whether the dialog should be positioned at the center
 *       of the viewport rather than at the bottom on desktop screens.
 * - supportsWideScreen: Whether the dialog supports a 808px width on viewports
 *       that are >= 870px wide.
 */
export interface DesktopDialogConfig {
  isCenterPositioned?: boolean;
  supportsWideScreen?: boolean;
}

/**
 * The class for the top level dialog.
 */
export class Dialog {
  private doc_: Doc;
  private iframe_: FriendlyIframe;
  private graypane_: Graypane;
  private loadingView_: LoadingView | null;
  private container_: Element | null;
  private view_: View | null;
  private animating_: Promise<void> | null;
  /** Helps identify stale animations. */
  private animationNumber_: number;
  private hidden_: boolean;
  private closeOnBackgroundClick_?: boolean;
  private previousProgressView_: View | null;
  private maxAllowedHeightRatio_: number;
  private positionCenterOnDesktop_: boolean;
  private shouldDisableBodyScrolling_: boolean;
  private desktopMediaQuery_: MediaQueryList;
  private enableBackgroundClickExperiment_ = false;
  /** Reference to the listener that acts on changes to desktopMediaQuery. */
  private desktopMediaQueryListener_: (() => void) | null;

  /**
   * Create a dialog for the provided doc.
   */
  constructor(
    doc: Doc,
    importantStyles: {[key: string]: string} = {},
    styles: {[key: string]: string} = {},
    dialogConfig: DialogConfig = {}
  ) {
    this.doc_ = doc;

    const desktopDialogConfig = dialogConfig.desktopConfig || {};
    const supportsWideScreen = !!desktopDialogConfig.supportsWideScreen;

    const defaultIframeCssClass = `swg-dialog ${
      supportsWideScreen ? 'swg-wide-dialog' : ''
    }`;
    const iframeCssClass =
      dialogConfig.iframeCssClassOverride || defaultIframeCssClass;

    this.iframe_ = new FriendlyIframe(doc.getWin().document, {
      'class': iframeCssClass,
    });

    this.graypane_ = new Graypane(doc, Z_INDEX - 1);

    this.closeOnBackgroundClick_ = dialogConfig.closeOnBackgroundClick;

    const modifiedImportantStyles = Object.assign(
      {},
      rootElementImportantStyles,
      importantStyles
    );
    setImportantStyles(this.iframe_.getElement(), modifiedImportantStyles);

    setStyles(this.iframe_.getElement(), styles);

    this.loadingView_ = null;

    this.container_ = null; // Depends on constructed document inside iframe.

    this.view_ = null;

    this.animating_ = null;

    this.animationNumber_ = 0;

    this.hidden_ = false;

    this.previousProgressView_ = null;

    this.maxAllowedHeightRatio_ =
      dialogConfig.maxAllowedHeightRatio !== undefined
        ? dialogConfig.maxAllowedHeightRatio
        : 0.9;

    this.positionCenterOnDesktop_ = !!desktopDialogConfig.isCenterPositioned;

    this.shouldDisableBodyScrolling_ =
      !!dialogConfig.shouldDisableBodyScrolling;

    this.desktopMediaQuery_ = this.doc_
      .getWin()
      .matchMedia('(min-width: 641px)');

    this.desktopMediaQueryListener_ = null;
  }

  setEnableBackgroundClickExperiment(value: boolean) {
    this.enableBackgroundClickExperiment_ = value;
  }
  /**
   * Opens the dialog and builds the iframe container.
   */
  async open(hidden = false): Promise<Dialog> {
    // If this experiment is active, the behavior of the grey background
    // changes.  If closable, clicking the background closes the dialog.  If not
    // closable, clicking the background now prevents you from clicking links
    // on the main page.;
    if (
      this.enableBackgroundClickExperiment_ &&
      this.closeOnBackgroundClick_ !== undefined
    ) {
      this.graypane_
        .getElement()
        .addEventListener('click', this.onGrayPaneClick_.bind(this));
    }

    const iframe = this.iframe_;
    if (iframe.isConnected()) {
      throw new Error('already opened');
    }

    // Attach.
    this.doc_.getBody()?.appendChild(iframe.getElement()); // Fires onload.

    this.graypane_.attach();

    if (hidden) {
      setImportantStyles(iframe.getElement(), {
        'visibility': 'hidden',
        'opacity': '0',
      });
      this.hidden_ = hidden;
    } else {
      this.show_();
    }

    await iframe.whenReady();
    this.buildIframe_();
    return this;
  }

  /**
   * Build the iframe with the styling after iframe is loaded.
   */
  private buildIframe_(): void {
    const iframe = this.iframe_;
    const iframeBody = iframe.getBody();
    const iframeDoc = /** @type {!HTMLDocument} */ this.iframe_.getDocument();

    // Inject Google fonts in <HEAD> section of the iframe.
    injectStyleSheet(resolveDoc(iframeDoc), UI_CSS);

    // Add Loading indicator.
    const loadingViewClasses = [];
    if (this.isPositionCenterOnDesktop()) {
      loadingViewClasses.push('centered-on-desktop');
    }
    this.loadingView_ = new LoadingView(iframeDoc, {
      additionalClasses: loadingViewClasses,
    });
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
   */
  async close(animated = true): Promise<void> {
    let animating;
    if (animated) {
      const transitionStyles: {[key: string]: string} =
        this.shouldPositionCenter_()
          ? {'opacity': '0'}
          : {'transform': 'translateY(100%)'};

      animating = this.animate_(() => {
        this.graypane_.hide(/* animate */ true);
        return transition(this.getElement(), transitionStyles, 300, 'ease-out');
      });
    } else {
      animating = Promise.resolve();
    }

    this.doc_.getBody()?.classList.remove('swg-disable-scroll');

    await animating;

    const iframeEl = this.iframe_.getElement();
    iframeEl.parentNode?.removeChild(iframeEl);

    this.removePaddingToHtml_();
    this.graypane_.destroy();
    if (this.desktopMediaQueryListener_) {
      this.desktopMediaQuery_.removeListener(this.desktopMediaQueryListener_);
    }
  }

  /**
   * Gets the container within the dialog.
   */
  getContainer(): Element {
    if (!this.container_) {
      throw new Error('not opened yet');
    }
    return this.container_;
  }

  /**
   * Gets the attached iframe instance.
   */
  getIframe(): FriendlyIframe {
    return this.iframe_;
  }

  /**
   * Gets the Iframe element.
   */
  getElement(): HTMLIFrameElement {
    return this.iframe_.getElement();
  }

  /**
   * Gets the LoadingView for this dialog.
   */
  getLoadingView(): LoadingView | null {
    return this.loadingView_;
  }

  /**
   * Returns the max allowed height of the view as a ratio of viewport height.
   */
  getMaxAllowedHeightRatio(): number {
    return this.maxAllowedHeightRatio_;
  }

  /**
   * Returns whether the dialog is center-positioned on desktop screens.
   */
  isPositionCenterOnDesktop(): boolean {
    return this.positionCenterOnDesktop_;
  }

  /**
   * Transitions to the next view.
   */
  private entryTransitionToNextView_(): void {
    if (this.view_ && this.view_.hasLoadingIndicator()) {
      // Temporarily cache the old view.
      this.previousProgressView_ = this.view_;
    } else {
      // Since loading indicator will be shown, remove contents of old view.
      removeChildren(this.getContainer());
      // When loading indicator was not displayed in the previous view,
      // loading indicator must be displayed while transitioning to new view.
      this.loadingView_?.show();
    }
  }

  /**
   * Transition out of an old view.
   */
  private exitTransitionFromOldView_(): void {
    // If previous view is still around, remove it.
    if (this.previousProgressView_) {
      removeElement(this.previousProgressView_.getElement());
      this.previousProgressView_ = null;
    } else {
      this.loadingView_?.hide();
    }
  }

  getCurrentView(): View | null {
    return this.view_;
  }

  /**
   * Opens the given view and removes existing view from the DOM if any.
   */
  async openView(view: View): Promise<void> {
    setImportantStyles(view.getElement(), resetViewStyles);
    this.entryTransitionToNextView_();

    this.view_ = view;
    this.getContainer().appendChild(view.getElement());

    if (this.shouldDisableBodyScrolling_) {
      this.doc_.getBody()?.classList.add('swg-disable-scroll');
    }

    // If the current view should fade the parent document.
    if (view.shouldFadeBody() && !this.hidden_) {
      this.graypane_.show(/* animated */ view.shouldAnimateFade());
    }

    await view.init(this);
    setImportantStyles(view.getElement(), {
      'opacity': '1',
    });
    if (this.hidden_) {
      if (view.shouldFadeBody()) {
        this.graypane_.show(/* animated */ view.shouldAnimateFade());
      }
      this.show_();
    }
    this.exitTransitionFromOldView_();
  }

  /**
   * Show the iframe.
   */
  private show_(): void {
    this.animate_(async () => {
      setImportantStyles(this.getElement(), {
        'transform': 'translateY(100%)',
        'opactiy': '1',
        'visibility': 'visible',
      });

      await transition(
        this.getElement(),
        {
          'transform': this.getDefaultTranslateY_(),
          'opacity': '1',
          'visibility': 'visible',
        },
        300,
        'ease-out'
      );

      // Focus the dialog contents, per WAI-ARIA best practices.
      this.getElement().focus();
    });

    this.hidden_ = false;
  }

  /** Suppresses click events and may close the window. */
  private onGrayPaneClick_(event: Event) {
    event.stopPropagation();
    if (this.closeOnBackgroundClick_) {
      const viewEl = this.view_!.getElement();
      const contentWindow = viewEl.contentWindow!;
      if (contentWindow) {
        const origin = viewEl.src ? new URL(viewEl.src).origin : '*';
        // The boq iframe must be listening for this event in order for it to
        // work.
        contentWindow.postMessage('close', origin);
      }
    }
    return false;
  }

  /**
   * Resizes the dialog container.
   */
  async resizeView(
    view: View,
    height: number,
    animated = true
  ): Promise<null | void> {
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

          const immediateStyles: {[key: string]: string} = {
            'height': `${newHeight}px`,
          };
          if (!this.shouldPositionCenter_()) {
            immediateStyles['transform'] = `translateY(${
              newHeight - oldHeight
            }px)`;
          }
          setImportantStyles(this.getElement(), immediateStyles);

          requestAnimationFrame(() => {
            transition(
              this.getElement(),
              {
                'transform': this.getDefaultTranslateY_(),
              },
              300,
              'ease-out'
            );
          });
          return Promise.resolve();
        });
      } else {
        // Collapse.
        animating = this.animate_(async () => {
          const transitionPromise = isStale()
            ? Promise.resolve()
            : transition(
                this.getElement(),
                {
                  'transform': this.shouldPositionCenter_()
                    ? this.getDefaultTranslateY_()
                    : `translateY(${oldHeight - newHeight}px)`,
                },
                300,
                'ease-out'
              );

          await transitionPromise;

          if (isStale()) {
            return;
          }

          setImportantStyles(this.getElement(), {
            'height': `${newHeight}px`,
            'transform': this.getDefaultTranslateY_(),
          });
        });
      }
    } else {
      setImportantStyles(this.getElement(), {
        'height': `${newHeight}px`,
      });
      animating = Promise.resolve();
    }

    await animating;

    if (isStale()) {
      return;
    }

    this.updatePaddingToHtml_(height);
    view.resized();
  }

  private async animate_(callback: () => Promise<void>): Promise<void> {
    await this.animating_;

    try {
      await callback();
    } catch (err) {
      // Ignore errors to make sure animations don't get stuck.
    }

    this.animating_ = null;
  }

  /**
   * Returns maximum allowed height for current viewport.
   */
  private getMaxAllowedHeight_(height: number): number {
    return Math.min(
      height,
      this.doc_.getWin()./*OK*/ innerHeight * this.maxAllowedHeightRatio_
    );
  }

  /**
   * Update padding-bottom on the containing page to not hide any content
   * behind the popup, if rendered at the bottom. For centered dialogs, there
   * should be no added padding.
   */
  private updatePaddingToHtml_(newHeight: number) {
    if (this.shouldPositionCenter_()) {
      // For centered dialogs, there should be no bottom padding.
      this.removePaddingToHtml_();
      return;
    }
    const bottomPadding = newHeight + 20; // Add some extra padding.
    const htmlElement = this.doc_.getRootElement();
    setImportantStyles(htmlElement, {
      'padding-bottom': `${bottomPadding}px`,
    });
  }

  /**
   * Removes previouly added bottom padding from the document.
   */
  private removePaddingToHtml_() {
    this.doc_.getRootElement().style.removeProperty('padding-bottom');
  }

  /**
   * Sets the position of the dialog. Currently only supports 'BOTTOM', with
   * an option of switching to 'CENTER' on desktop screens.
   */
  private setPosition_() {
    setImportantStyles(this.getElement(), this.getPositionStyle_());
  }

  /**
   * Returns whether or not the dialog should have position 'CENTER'.
   */
  private shouldPositionCenter_(): boolean {
    return this.positionCenterOnDesktop_ && this.desktopMediaQuery_.matches;
  }

  /**
   * Returns the styles required to postion the dialog.
   */
  private getPositionStyle_(): {[key: string]: string} {
    if (this.shouldPositionCenter_()) {
      return {
        'top': '50%',
        'bottom': '0',
        'transform': this.getDefaultTranslateY_(),
      };
    }
    return {
      'top': 'auto',
      'bottom': '0',
      'transform': this.getDefaultTranslateY_(),
    };
  }

  /**
   * Returns default translateY style for the dialog.
   */
  private getDefaultTranslateY_(): string {
    if (this.shouldPositionCenter_()) {
      return 'translateY(-50%)';
    }
    return 'translateY(0px)';
  }
}
