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
import {Deps} from './deps';
import {SmartBoxMessage} from '../proto/api_messages';
import {SmartButtonOptions} from '../api/subscriptions';
import {createElement} from '../utils/dom';
import {feArgs, feUrl} from './services';
import {setImportantStyles} from '../utils/style';

const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
};

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
}

/**
 * The class for Smart button Api.
 */
export class SmartSubscriptionButtonApi {
  private readonly activityPorts_: ActivityPorts;
  private readonly iframe_: HTMLIFrameElement;
  private readonly src_ = feUrl('/smartboxiframe');
  private readonly args_: {[key: string]: string};

  constructor(
    private readonly deps_: Deps,
    private readonly button_: Element,
    private readonly options_: SmartButtonOptions,
    private readonly callback_?: (event?: Event) => void
  ) {
    this.activityPorts_ = deps_.activities();

    this.iframe_ = createElement(
      deps_.win().document,
      'iframe',
      iframeAttributes
    );

    const frontendArguments: {[key: string]: string} = {
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'theme': (this.options_ && this.options_.theme) || 'light',
      'lang': (this.options_ && this.options_.lang) || 'en',
    };
    const messageTextColor = this.options_ && this.options_.messageTextColor;
    if (messageTextColor) {
      frontendArguments['messageTextColor'] = messageTextColor;
    }

    this.args_ = feArgs(frontendArguments);
  }

  handleSmartBoxClick_(smartBoxMessage: SmartBoxMessage) {
    if (smartBoxMessage && smartBoxMessage.getIsClicked()) {
      this.callback_?.();
    }
  }

  /**
   * Make a call to build button content and listens for the 'click' message.
   */
  start(): Element {
    setImportantStyles(this.iframe_, {
      'opacity': '1',
      'position': 'absolute',
      'top': '0',
      'bottom': '0',
      'left': '0',
      'height': '100%',
      'right': '0',
      'width': '100%',
    });
    this.button_.appendChild(this.iframe_);
    const args = this.activityPorts_.addDefaultArguments(this.args_);
    this.activityPorts_
      .openIframe(this.iframe_, this.src_, args)
      .then((port) => {
        port.on(SmartBoxMessage, this.handleSmartBoxClick_.bind(this));
      });
    return this.iframe_;
  }
}
