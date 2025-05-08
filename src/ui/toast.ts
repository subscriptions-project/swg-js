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
import {createElement} from '../utils/dom';
import {resetStyles, setImportantStyles} from '../utils/style';
import {transition} from '../utils/animation';

export const toastImportantStyles = {
  'height': '0',
};

export interface ToastSpecDef {
  text: string;
  action?: {label: string; handler: () => void};
}

const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
  'class': 'swg-toast',
};

/**
 * The class Notification toast.
 */
export class Toast {
  private readonly doc_: Doc;
  private readonly activityPorts_: ActivityPorts;
  private animating_: Promise<void> | null = null;
  private readonly iframe_: HTMLIFrameElement;

  constructor(
    deps: Deps,
    private readonly src_: string,
    private readonly args_: {[key: string]: string} = {}
  ) {
    this.doc_ = deps.doc();

    this.activityPorts_ = deps.activities();

    this.iframe_ = createElement(
      this.doc_.getWin().document,
      'iframe',
      iframeAttributes
    );

    setImportantStyles(this.iframe_, toastImportantStyles);
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
    await port.whenReady();
    resetStyles(this.iframe_, ['height']);

    this.animating_ = this.animate_({
      callback: () => {
        setImportantStyles(this.iframe_, {
          'transform': 'translateY(100%)',
          'opacity': '1',
          'visibility': 'visible',
        });
        return transition(
          this.iframe_,
          {
            'transform': 'translateY(0)',
            'opacity': '1',
            'visibility': 'visible',
          },
          400,
          'ease-out'
        );
      },
    });

    // Close the Toast after the specified duration.
    this.doc_.getWin().setTimeout(() => {
      this.close();
    }, (toastDurationSeconds + 1) * 1000);
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

        return transition(
          this.iframe_,
          {
            'transform': 'translateY(100%)',
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
