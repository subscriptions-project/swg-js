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
 * Returns embedded HTML for offers to use with iframe's srcdoc
 * attribute (friendly iframe).
 * @param {!SubscriptionResponse} subscriptions The user subscription details.
 * @return {string}
 */
export function renderOffers(subscriptions) {

  const offers =
    `
      <html>
        <head></head>
        ${getStyle_()}
        <body>
          <div class="swg-container swg-offers">
            <div class="swg-header">
              <div class="swg-branding">
                <div class="swg-logo">
                  <img height="45" src="./icons/icon-2x.png"/>
                </div>
                <div class="swg-branding-header">
                  <span class="swg-brand-name">The Scenic</span>
                </div>
              </div>
              <div class="swg-branding-description">
                Choose one of the following offers, to purchase membership.
              </div>
            </div>
            <!--The content area-->
            ${getContent_(subscriptions)}
            <!--The footer-->
            ${getOffersFooter_()}
          </div>
        </body>
      </html>
    `;
  return offers;
}

/**
 * Returns embedded HTML for abbreviated view to use with iframe's srcdoc
 * attribute (friendly iframe).
 * @return {string}
 */
export function abbreviatedView(subscriptions) {
  const meteringResponse = subscriptions.metering;
  const abbreviatedView =
    `
      <html>
        <head></head>
        ${getStyle_()}
        <body>
          <div class="swg-container">
            <div class="swg-header" style="display: flex;">
              <span style="flex: 1;"></span>
              <div style="padding-top: 8px;">
                ${getQuotaMessage_(meteringResponse)}
              </div>
              <span style="flex: 1;"></span>
            </div>
            <!--The content area-->
            ${getAbbreviatedViewContent_()}
            <!--The footer-->
            ${getAbbreviatedViewFooter_()}
          </div>
        </body>
      </html>
    `;
  return abbreviatedView;
}

/**
 * Returns HTML for quota left message.
 * @private
 */
function getQuotaMessage_(meteringResponse) {
  const quotaLeft = meteringResponse.quotaLeft;
  const maxQuota = meteringResponse.maxQuota;
  const quotaPeriod = meteringResponse.quotaPeriod;
  return quotaLeft == maxQuota
  ? `You can read <span style="font-weight: 500;">${quotaLeft}</span>
      ${quotaLeft > 1 ? 'articles' : 'article'} free this ${quotaPeriod}!`
  : `<span style="font-weight: 500;">${quotaLeft} </span>
      ${quotaLeft > 1 ? 'articles' : 'article'} left for this ${quotaPeriod}!`;
}

/**
 * Sets the CSS style for the component.
 * injected in JavaScript code as a string.
 * @private
 */
function getStyle_() {
  const fonts = '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:300,400,500,700" type="text/css">';
  const style = `${fonts}<style>${OFFERS_CSS}</style> `;
  return style;
}

/**
 * Builds and returns the content HTML for the offer dialog.
 * @param {!SubscriptionResponse} subscriptions The user subscription details.
 * @private
 */
function getContent_(subscriptions) {
  const offers = subscriptions.offer;
  let offerContent = '';
  for (let i = 0; i < offers.length; i++) {
    const checked = `${(i == 0) ? 'checked' : ''}`;
    offerContent += `
        <div class="${SWG_OFFER_ITEM_CLASS} ${checked}" data-offer-index="${i}" tabindex="1">
          <span>${offers[i].displayString}</span>
        </div>
    `;
  }
  return `<div class="${SWG_OFFER_CONTENT_CLASS}" id="${SWG_OFFER_CONTENT_CLASS}"
      >${offerContent}</div>`;
}

/**
 * Builds and returns the content HTML for abbreviated view.
 * @private
 */
function getAbbreviatedViewContent_() {
  const abbreviatedViewcontent =
    `
      <div class="swg-abbreviated-view">
        <div class="swg-logo">
          <img height="50" src="./icons/icon-2x.png"/>
        </div>
        <div class="swg-abbreviated-view-description">
          <div class="swg-heading">Award winning content.</div>
          <div class="swg-sub-heading">Become subscriber now. Start free</div>
        </div>
      </div>
    `;
  return abbreviatedViewcontent;
}

/**
 * Builds and returns the footer HTML for the offer dialog.
 * @private
 */
function getOffersFooter_() {
  const footer =
    `
    <div class="swg-footer">
      <div class="swg-h-spacer"></div>
      <button class="swg-button" id="swg-button">
        <span class="swg-label">Continue</span>
      </button>
    </div>
    `;
  return footer;
}

/**
 * Builds and returns the footer HTML for the abbreviatedView.
 * @private
 */
function getAbbreviatedViewFooter_() {
  const footer =
  `
  <div class="swg-footer swg-abbreviated-footer">
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
