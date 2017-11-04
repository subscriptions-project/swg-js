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

/** @const {string} */
export const IFRAME_CLASS = 'swg-iframe';

/** @const {string} */
export const SWG_OFFER_CONTENT_CLASS = 'swg-content';

/** @const {string} */
export const SWG_OFFER_ITEM_CLASS = 'swg-offer-item';


/**
 * Checks if current user is a subscriber. It does not check the healthy status.
 * @param {!SubscriptionResponse} subscriptionResponse The API response.
 * @return {boolean}
 */
export function isSubscriber(subscriptionResponse) {
  // TODO(avimehta, #21): Remove the check for 'entitled' before launch.
  return subscriptionResponse['entitled'] ||
      (subscriptionResponse['subscriber'] &&
      subscriptionResponse['subscriber']['types'] &&
      subscriptionResponse['subscriber']['types'].length > 0);
}

/**
 * Checks if current user is metered.
 * @param {!SubscriptionResponse} subscriptionResponse The API response.
 * @return {boolean}
 */
export function isMeteredUser(subscriptionResponse) {
  return subscriptionResponse['metering'] &&
        subscriptionResponse['metering']['quotaLeft'] > 0;
}

 /**
  * Checks if the subscription element is already available in Dom.
  * @param {!Document} doc
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
 * Renders offers view. Called from the subscriptions flow.
 */
export function renderOffersView(subscriptions) {
  const abbreviatedView =
    `
      <html>
        <head>${getStyle()}</head>
        <body>
          <div class="swg-container">
            ${renderOffersViewContent_(subscriptions)}
          </div>
        </body>
      </html>
    `;
  return abbreviatedView;
}

/**
 * Renders abbreviated view. Called from the subscriptions flow.
 */
export function renderAbbreviatedView(subscriptions) {
  const meteringResponse = subscriptions.metering;
  const abbreviatedView =
    `
      <html>
        <head>${getStyle()}</head>
        <body>
          <div class="swg-container">
            ${renderAbbreviatedViewContent_(meteringResponse)}
            ${renderAbbreviatedViewFooter_()}
          </div>
        </body>
      </html>
    `;
  return abbreviatedView;
}

/**
 * Sets the CSS style for the component.
 * injected in JavaScript code as a string.
 */
export function getStyle() {
  const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700" type="text/css">';
  const style = `${fonts}<style>${OFFERS_CSS}</style> `;
  return style;
}

/**
 * Renders offers view content.
 * @private
 */
function renderOffersViewContent_(subscriptions) {
  const offers = subscriptions.offer;
  const types = ['Basic', 'Premium'];
  let offerContent = '';
  for (let i = 0; i < offers.length; i++) {
    offerContent += `
      <div class="${SWG_OFFER_ITEM_CLASS}" data-offer-index="${i}"
          tabindex="1" role="button">
        <div class="swg-offer-item-header">${types[i]} subscription</div>
        <div class="swg-offer-item-detail">${offers[i]['displayString']}</div>
      </div>
    `;
  }
  return `
      <div class="swg-offer-header">Select an offer to continue</div>
      <div>${offerContent}</div>
  `;
}

/**
 * Builds and returns the content HTML for abbreviated view.
 * @private
 */
function renderAbbreviatedViewContent_(meteringResponse) {
  const quotaLeft = meteringResponse.quotaLeft;
  const abbreviatedViewcontent =
    `
      <div class="swg-abbreviated-view">
        <div class="swg-abbreviated-view-description">
          <div class="swg-heading">Hi there,</div>
          <div class="swg-sub-heading">
            You can subscribe to
            <span>The scenic</span>
            with your Google account.
          </div>
          <div class="swg-already-link" id="swg-already-link" role="link"
              tabindex="1">
            Already subscriber?
          </div>
        </div>
        <div class="swg-metering">
          <div class="swg-metering-count"><div>${quotaLeft}</div></div>
          <div class="swg-metering-label">Articles left</div>
        </div>
      </div>
    `;
  return abbreviatedViewcontent;
}

/**
 * Renders footer (Subscribe with Google button) for abbreviated view.
 * @private
 */
function renderAbbreviatedViewFooter_() {
  const footer =
  `
  <div class="swg-subscribe-footer swg-abbreviated-footer">
    <div id="swg-button" class="swg-button" role="button" tabindex="1">
      <div class="swg-button-content-wrapper">
        <div class="swg-button-icon"><div class="swg-icon"></div></div>
        <div class="swg-button-content">
          <span>Subscribe with Google</span>
        </div>
      </div>
    </div>
  </div>
  `;
  return footer;
}


/**
 * Returns 3P login Url.
 * @return {string}
 */
export function getPublisherLoginUrl() {
  // TODO(dparikh, #135): Fetch correct login Url for current publisher.
  return '/examples/sample-pub/signin';
}
