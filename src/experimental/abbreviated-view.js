/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {renderAbbreviatedView} from './utils';
import {BaseView} from './base-view';

/**
 * Abbreviated view. Renders the content in the parent <swg-popup>
 * element.
 */
export class AbbreviatedView extends BaseView {

  /**
   * @param {!Window} win The parent window object.
   * @param {!Element} context The Subscription container reference.
   * @param {!Element} offerContainer The offer container element <swg-popup>.
   * @param {!SubscriptionResponse} subscriptions The subscriptions object.
   */
  constructor(win, context, offerContainer, subscriptions) {
    super(win, context, offerContainer);

    /** @private @const {!SubscriptionResponse} */
    this.subscriptions_ = subscriptions;

    /** @private {?function()} */
    this.subscribeClicked_ = null;
  }

  /**
   * @param {function()} callback
   * @return {!LoginWithView}
   */
  onAlreadySubscribedClicked(callback) {
    this.alreadySubscribedClicked_ = callback;
    return this;
  }

  /**
   * @param {function()} callback
   * @return {!OffersView}
   */
  onSubscribeClicked(callback) {
    this.subscribeClicked_ = callback;
    return this;
  }

  /**
   * Returns if document should fade for this view.
   * @return {boolean}
   */
  shouldFadeBody() {
    return false;
  }

  /*
   * Builds the  abbreviated view element within the <swg-popup> element.
   * @return {!Promise}
   */
  buildView() {
    const iframeSourceDoc = renderAbbreviatedView(this.subscriptions_);
    const buildPromise = super.buildView(iframeSourceDoc);

    // Add subscribe button listener.
    return buildPromise.then(() => {
      const subscribeButton =
          this.viewElement_.contentDocument.getElementById('swg-button');
      const alreadySubscriberLink =
          this.viewElement_.contentDocument.getElementById('swg-already-link');

      subscribeButton.onclick = () => {
        this.subscribeClicked_();
      };

      alreadySubscriberLink.onclick = () => {
        this.alreadySubscribedClicked_();
      };

      subscribeButton.addEventListener('keypress', event => {
        if (event.keyCode == 13) {
          this.subscribeClicked_();
        }
      });
    });
  }
}
