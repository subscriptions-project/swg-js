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

/**
 * Maximum value for z-index (32 bit Integer).
 * @const {number}
 */
export const MAX_Z_INDEX = 2147483647;

/** @const {string} */
export const IFRAME_CLASS = 'swg-iframe';


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
  const style = `${fonts}`;
  return style;
}

/**
 * Builds and returns the content HTML for abbreviated view.
 * @private
 */
function renderAbbreviatedViewContent_(meteringResponse) {
  const meteringBadge = meteringResponse ?
    `
        <div class="swg-metering">
          <div class="swg-metering-count">
            <div>${meteringResponse.quotaLeft}</div>
          </div>
          <div class="swg-metering-title">Articles left</div>
        </div>
    ` : '';

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
        ${meteringBadge}
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
  return '/examples/sample-pub/pub-signin';
}
