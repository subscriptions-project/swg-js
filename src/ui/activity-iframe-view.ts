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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {ActivityResult} from 'web-activities/activity-ports';
import {Dialog} from '../components/dialog';
import {Message} from '../proto/api_messages';
import {View} from '../components/view';
import {acceptPortResultData} from '../utils/activity-utils';
import {createElement} from '../utils/dom';
import {isCancelError} from '../utils/errors';

const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
};

/**
 * Class to build and render Activity iframe view.
 */
export class ActivityIframeView extends View {
  private readonly doc_: Document;
  private readonly iframe_: HTMLIFrameElement;
  private port_: ActivityIframePort | null = null;
  private portResolver_?: (
    port: ActivityIframePort | Promise<ActivityIframePort>
  ) => void;
  private readonly portPromise_: Promise<ActivityIframePort>;

  constructor(
    private readonly win_: Window,
    private readonly activityPorts_: ActivityPorts,
    private readonly src_: string,
    /** Additional data to be passed to the iframe. */
    private readonly args_: {[key: string]: string},
    private readonly shouldFadeBody_: boolean = false,
    private readonly hasLoadingIndicator_: boolean = false,
    private readonly shouldAnimateFade_: boolean = false
  ) {
    super();

    this.doc_ = this.win_.document;

    this.iframe_ = createElement(this.doc_, 'iframe', iframeAttributes);

    this.portPromise_ = new Promise((resolve) => {
      this.portResolver_ = resolve;
    });
  }

  getElement() {
    return this.iframe_;
  }

  async init(dialog: Dialog) {
    const port = await this.activityPorts_.openIframe(
      this.iframe_,
      this.src_,
      this.args_
    );
    return this.onOpenIframeResponse_(port, dialog);
  }

  /**
   * Returns if document should fade for this view.
   */
  shouldFadeBody(): boolean {
    return this.shouldFadeBody_;
  }

  /**
   * Returns if the view shows loading indicator.
   */
  hasLoadingIndicator(): boolean {
    return this.hasLoadingIndicator_;
  }

  private onOpenIframeResponse_(
    port: ActivityIframePort,
    dialog: Dialog
  ): Promise<void> {
    this.port_ = port;
    this.portResolver_!(port);

    this.port_.onResizeRequest((height) => {
      dialog.resizeView(this, height);
    });

    return this.port_.whenReady();
  }

  private getPortPromise_(): Promise<ActivityIframePort> {
    return this.portPromise_;
  }

  async on<T extends Message>(
    message: new (data?: unknown[], includesLabel?: boolean) => T,
    callback: (p1: T) => void
  ): Promise<void> {
    const port = await this.getPortPromise_();
    port.on(message, callback);
  }

  async execute(request: Message) {
    const port = await this.getPortPromise_();
    port.execute(request);
  }

  /**
   * Accepts results from the caller.
   */
  async acceptResult(): Promise<ActivityResult> {
    const port = await this.getPortPromise_();
    return port.acceptResult();
  }

  /**
   * Accepts results from the caller and verifies origin.
   */
  async acceptResultAndVerify(
    requireOrigin: string,
    requireOriginVerified: boolean,
    requireSecureChannel: boolean
  ): Promise<unknown> {
    const port = await this.getPortPromise_();
    return acceptPortResultData(
      port,
      requireOrigin,
      requireOriginVerified,
      requireSecureChannel
    );
  }

  /**
   * Completes the flow.
   */
  async whenComplete(): Promise<void> {
    await this.acceptResult();
  }

  async onCancel(callback: () => void): Promise<void> {
    try {
      await this.acceptResult();
    } catch (err) {
      if (isCancelError(err as Error)) {
        callback();
      }
      throw err;
    }
  }

  resized() {
    if (this.port_) {
      this.port_.resized();
    }
  }

  shouldAnimateFade(): boolean {
    return this.shouldAnimateFade_;
  }
}
