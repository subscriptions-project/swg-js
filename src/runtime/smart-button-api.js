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


import {createElement} from '../utils/dom';
import {setImportantStyles} from '../utils/style';
import {feArgs, feUrl} from './services';

/** @const {!Object<string, string>} */
const iframeAttributes = {
  'frameborder': '0',
  'scrolling': 'no',
};

/**
 * @enum {string}
 */
export const Theme = {
  LIGHT: 'light',
  DARK: 'dark',
};


/**
 * The class for Smart button Api.
 */
export class SmartSubscriptionButtonApi {
  /**
   * @param {!./deps.DepsDef} deps
   * @param {!Element} button
   * @param {!../api/subscriptions.ButtonOptions} options
   * @param {function()=} callback
   */
  constructor(deps, button, options, callback) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!Document} */
    this.doc_ = this.win_.document;

    /** @private @const {!../components/activities.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!HTMLIFrameElement} */
    this.iframe_ =
    /** @type {!HTMLIFrameElement} */ (
        createElement(this.doc_, 'iframe', iframeAttributes));

    /** @private @const {!Element} */
    this.button_ = button;

    /** @private {!../api/subscriptions.ButtonOptions} */
    this.options_ = options;

    /** @private const {function()=} */
    this.callback_ = callback;

    /** @private @const {string} */
    this.src_ = feUrl('/smartboxiframe');

    /** @private @const {!Object} */
    this.args_ = feArgs({
      'productId': this.deps_.pageConfig().getProductId(),
      'publicationId': this.deps_.pageConfig().getPublicationId(),
      'theme': this.options_ && this.options_.theme || 'light',
      'lang': this.options_ && this.options_.lang || 'en',
    });
  }

  /**
   * Make a call to build button content and listens for the 'click' message.
   * @return {!Element}
   */
  start() {
    /**
     * Add a callback to the button itself to fire the iframe's button click
     * action when user tabs to the container button and hits enter.
     */
    this.button_.addEventListener('click', () => {
      this.callback_();
    });

    setImportantStyles(this.iframe_, {
      'opacity': 1,
      'position': 'absolute',
      'top': 0,
      'bottom': 0,
      'left': 0,
      'height': '100%',
      'right': 0,
      'width': '100%',
    });
    this.button_.appendChild(this.iframe_);
    this.activityPorts_.openIframe(this.iframe_, this.src_, this.args_)
        .then(port => {
          port.onMessageDeprecated(result => {
            if (result['clicked']) {
              if (!this.callback_) {
                throw new Error('No callback!');
              }
              this.callback_();
              return;
            }
          });
        });
    return this.iframe_;
  }
}
