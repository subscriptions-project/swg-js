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


import {ActivityIframeView} from '../ui/activity-iframe-view';
import {Theme} from './button-api';
//import {SubscriptionFlows} from '../api/subscriptions';
import {setImportantStyles} from '../utils/style';
import {feArgs, feUrl} from './services';


/**
 * The class for Smart button Api.
 */
export class SmartSubscriptionButtonApi {

  /**
   * @param {!./deps.DepsDef} deps
   * @param {!Element} container
   * @param {!../api/subscriptions.ButtonOptions|undefined} options
   * @param {function()=} callback
   */
  constructor(deps, container, options, callback) {
    /** @private @const {!./deps.DepsDef} */
    this.deps_ = deps;

    /** @private @const {!Window} */
    this.win_ = deps.win();

    /** @private @const {!web-activities/activity-ports.ActivityPorts} */
    this.activityPorts_ = deps.activities();

    /** @private @const {!../components/dialog-manager.DialogManager} */
    this.dialogManager_ = deps.dialogManager();

    /** @private @const {!Element} */
    this.container_ = container;

    /** @private const {?function()=} */
    this.callback_ = callback;

    /** @private @const {string} */
    this.theme_ = options && options.theme || Theme.LIGHT;

    /** @private {boolean} */
    this.isClosable_ = options && options.isClosable || false;
    if (this.isClosable_ == undefined) {
      this.isClosable_ = false;  // Default is to hide Close button.
    }

    /** @private @const {!ActivityIframeView} */
    this.activityIframeView_ = new ActivityIframeView(
        this.win_,
        this.activityPorts_,
        feUrl('/smartboxiframe'),
        feArgs({
          'productId': deps.pageConfig().getProductId(),
          'publicationId': deps.pageConfig().getPublicationId(),
          'theme': this.theme_,
          'lang': options && options.lang || 'en',
        }),
        /* shouldFadeBody */ false);
  }

  /**
   * Starts the smart button subscription button flow.
   */
  start() {
    // If smart button was clicked, execute callback.
    this.activityIframeView_.onMessage(result => {
      if (result['clicked']) {
        if (!this.callback_) {
          throw new Error('No callback!');
        }
        this.callback_();
        return;
      }
    });
    this.buildContent_();
  }

  /**
   * @private
   */
  buildContent_() {
    this.container_.appendChild(this.activityIframeView_.getElement());

    setImportantStyles(this.container_, {
      'height': '126px',
    });

    this.activityIframeView_.initContainer().then(() => {
      setImportantStyles(this.activityIframeView_.getElement(), {
        'opacity': 1,
        'height': '100%',
      });
    });

  }
}
