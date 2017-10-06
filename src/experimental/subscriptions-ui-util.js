/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {CSS as OFFERS_CSS} from
    '../../build/css/experimental/swg-popup-offer.css';

/**
 * Maximum value for z-index (32 bit Integer).
 * @const {number}
 */
export const MAX_Z_INDEX = 2147483647;

/**
 * Dummy offer details.
 * @const {offer: {!Array<!Object>}}
 */
const SUBSCRIPTIONS = {
  offer: [
    {
      displayString: '7 days free, $8/mo, after',
      paymentRequest: '',
    },
    {
      displayString: '$85/year',
      paymentRequest: '',
    },
  ],
};

/**
 * Checks if current user is subscriber. It does not check the healthy status.
 * @param {!SubscriptionResponse} subscriptionResponse The Api response.
 * @return {boolean}
 */
export function isSubscriber(subscriptionResponse) {
  return subscriptionResponse['subscriber'] &&
      subscriptionResponse['subscriber']['types'] &&
      subscriptionResponse['subscriber']['types'].length > 0;
}

 /**
  * Checks if the subscription element is already available in Dom.
  * @param {!Window} win The window object.
  * @param {string} elementTagName The name of the element.
  * @return {?string}
  */
export function assertNoPopups(doc, elementTagName) {
  const existingPopup = doc.querySelector(elementTagName);
  if (existingPopup) {
    throw new Error('Only one instance is allowed!');
  }
}

/**
 * Returns embedded HTML for abbreviated offers to use with iframe's srcdoc
 * attribute (friendly iframe).
 * @param {!SubscriptionResponse} subscriptions The user subscription details.
 * @return {string}
 */
export function getAbbreviatedOffers(subscriptions) {
  const meteringResponse = subscriptions.metering;
  const quotaLeft = meteringResponse.quotaLeft;
  const offers =
    `
      <html>
        <head></head>
        ${getStyle_()}
        <body>
          <div class="swg-container">
            <div class="swg-header" style="display: flex;">
            <span style="flex: 1;"></span>
              <div style="padding-top: 8px;">
                  You can read
                  <span style="font-weight: 500;">
                    ${quotaLeft}
                  </span>
                  ${quotaLeft > 1 ? 'articles' : 'article'}
                  for free this ${meteringResponse.quotaPeriod}!
              </div>
              <span style="flex: 1;"></span>
            </div>
            <!--The content area-->
            ${getContent_(subscriptions)}
            <!--The footer-->
            ${getFooter_()}
          </div>
        </body>
      </html>
    `;
  return offers;
}

/**
 * Sets the CSS style for the component.
 * injected in JavaScript code as a string.
 * @private
 */
function getStyle_() {
  const style = ` <style>${OFFERS_CSS}</style> `;
  return style;
}

/**
 * Builds and returns the content HTML for the offer dialog.
 * @param {!SubscriptionResponse} subscriptions The user subscription details.
 * @private
 */
function getContent_(subscriptions) {
  const offers = subscriptions.offer || SUBSCRIPTIONS.offer;
  let offerContent = '';
  for (let i = 0; i < offers.length; i++) {
    const pay = offers[i].paymentRequest;
    const checked = (i == 0) ? 'checked' : '';
    offerContent += `
        <div class="swg-offer-item">
          <label>
            <input type="radio" name="offer" value="${pay}" ${checked}>
            <span>${offers[i].displayString}</span>
          </label>
        </div>
    `;
  }
  return `<div class="swg-content" id="swg-content">${offerContent}</div>`;
}

/**
 * Builds and returns the footer HTML for the offer dialog.
 * @private
 */
function getFooter_() {
  const footer =
    `
    <div class="swg-footer">
      <div class="swg-h-spacer"></div>
      <span class="swg-sign-in">Sign in</span>
      <button class="swg-button" id="swg-button">
        <div class="swg-icon"></div>
        <span class="swg-label">Subscribe with Google</span>
      </button>
    </div>
    `;
  return footer;
}
