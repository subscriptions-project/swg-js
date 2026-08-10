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

import {ActivityPorts} from '../components/activities';
import {Deps} from '../runtime/deps';
import {Doc} from '../model/doc';
import {I18N_STRINGS} from '../i18n/strings';
import {createElement} from '../utils/dom';
import {msg} from '../utils/i18n';
import {resetStyles, setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

export const toastImportantStyles = {
  'height': '0',
};

export interface ToastSpecDef {
  text: string;
  action?: {label: string; handler: () => void};
}

/**
 * The class Notification toast.
 */
export class Toast {
  private readonly doc_: Doc;
  private readonly activityPorts_: ActivityPorts;
  private animating_: Promise<void> | null = null;
  private readonly iframe_: HTMLIFrameElement;
  private isDesktopAnimation_ = false;

  constructor(
    deps: Deps,
    private readonly src_: string,
    private readonly args_: {[key: string]: string} = {},
    private readonly className_: string = 'swg-toast'
  ) {
    this.doc_ = deps.doc();

    this.activityPorts_ = deps.activities();

    const lang = deps.clientConfigManager().getLanguage();
    const title = msg(I18N_STRINGS.SWG_NOTIFICATION, lang);

    const iframeAttributes = {
      'frameborder': '0',
      'scrolling': 'no',
      'class': this.className_,
      'title': title,
    };

    this.iframe_ = createElement(
      this.doc_.getWin().document,
      'iframe',
      iframeAttributes
    );

    setImportantStyles(this.iframe_, toastImportantStyles);
  }

  private isPublisherToast_(): boolean {
    return Boolean(this.className_?.split(' ').includes('publisher-toast'));
  }

  private checkIsDesktopPublisherToast_(): boolean {
    return (
      this.isPublisherToast_() &&
      this.doc_
        .getWin()
        .matchMedia('(min-width: 641px) and (min-height: 641px)').matches
    );
  }

  /**
   * Returns the iframe element.
   */
  getElement(): HTMLIFrameElement {
    return this.iframe_;
  }

  /**
   * Opens the notification toast.
   */
  open(): Promise<void> {
    this.doc_.getBody()?.appendChild(this.iframe_); // Fires onload.
    return this.buildToast_();
  }

  /**
   * Builds the content of the iframe. On load, animates the toast.
   */
  private async buildToast_(): Promise<void> {
    const toastDurationSeconds = 7;
    const port = await this.activityPorts_.openIframe(
      this.iframe_,
      this.src_,
      this.args_
    );
    let hasResized = false;
    port.onResizeRequest((height) => {
      hasResized = true;
      setImportantStyles(this.iframe_, {'height': `${height}px`});
      port.resized();
    });
    await port.whenReady();
    if (!hasResized) {
      resetStyles(this.iframe_, ['height']);
    }

    this.isDesktopAnimation_ = this.checkIsDesktopPublisherToast_();

    this.animating_ = this.animate_({
      callback: () => {
        const initialTransform = this.isDesktopAnimation_
          ? 'translateX(calc(100% + 30px))'
          : 'translateY(100%)';
        const targetTransform = this.isDesktopAnimation_
          ? 'translateX(0)'
          : 'translateY(0)';

        setImportantStyles(this.iframe_, {
          'transform': initialTransform,
          'opacity': '1',
          'visibility': 'visible',
        });
        return transition(
          this.iframe_,
          {
            'transform': targetTransform,
            'opacity': '1',
            'visibility': 'visible',
          },
          400,
          'ease-out'
        );
      },
    });

    // Close the Toast after the specified duration.
    this.doc_.getWin().setTimeout(
      () => {
        this.close();
      },
      (toastDurationSeconds + 1) * 1000
    );
  }

  private async animate_({
    callback,
  }: {
    callback: () => Promise<void>;
  }): Promise<void> {
    // Wait for previous animations to finish.
    await this.animating_;

    try {
      await callback();
    } catch {
      // Ignore errors to make sure animations don't get stuck.
    }
  }

  /**
   * Closes the toast.
   */
  close(): Promise<void> {
    this.animating_ = this.animate_({
      callback: () => {
        // Remove the toast from the DOM after animation is complete.
        this.doc_.getWin().setTimeout(() => {
          this.doc_.getBody()?.removeChild(this.iframe_);
        }, 500);

        const exitTransform = this.isDesktopAnimation_
          ? 'translateX(calc(100% + 30px))'
          : 'translateY(100%)';

        return transition(
          this.iframe_,
          {
            'transform': exitTransform,
            'opacity': '1',
            'visibility': 'visible',
          },
          400,
          'ease-out'
        );
      },
    });

    return this.animating_;
  }
}
