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
  * Builds and renders the close pop-up dialog button.
  * @param {!Element} container The container element <swg-popup>.
  * TODO(dparikh): Use the setImportantStyles() as discussed.
  */
export function addCloseButton(container) {
  const closeButton = document.createElement('button');
  closeButton.classList.add('swg-close-action');
  container.appendChild(closeButton);
  closeButton.innerText = 'X';
  const closeButtonStyle = closeButton.style;
  closeButtonStyle.setProperty('z-index', '2147483647', 'important');
  closeButtonStyle.setProperty('position', 'absolute', 'important');
  closeButtonStyle.setProperty('width', '28px', 'important');
  closeButtonStyle.setProperty('height', '28px', 'important');
  closeButtonStyle.setProperty('top', '8px', 'important');
  closeButtonStyle.setProperty('right', '10px', 'important');
  closeButtonStyle.setProperty('color', '#757575', 'important');
  closeButtonStyle.setProperty('font-size', '14px', 'important');
  closeButtonStyle.setProperty('background-size', '13px 13px', 'important');
  closeButtonStyle
      .setProperty('background-position', '9px center', 'important');
  closeButtonStyle.setProperty('background-color', '#ececec', 'important');
  closeButtonStyle.setProperty('background-repeat', 'no-repeat', 'important');
  closeButtonStyle.setProperty('border', 'none', 'important');

  closeButton.addEventListener('click', () =>
      container.style.setProperty('display', 'none', 'important'));
}

/**
 * Returns embedded HTML for abbriviated offers to use with iframe's srcdoc
 * attribute (friendly iframe).
 * @return {string}
 */
export function getAbbriviatedOffers() {
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
                  <span style="font-weight: 500;">10</span>
                  articles for free this month!
              </div>
              <span style="flex: 1;"></span>
            </div>
            <!--The content area-->
            ${getContent_()}
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
 * TODO(dparikh): Create a CSS file with build rules to compile this CSS and
 * injected in JavaScript code as a string.
 * @private
 */
function getStyle_() {
  const style =
    `
        <style>
        body {
          padding: 0;
          margin: 0;
        }

        .swg-header,
        .swg-footer {
          flex: 1;
          background-color: #ececec;
          height: 28px;
          padding: 6px;
        }

        .swg-footer {
          display: flex;
          height: 32px;
        }

        .swg-content {
          height: 116px;
          overflow-y: auto;
        }

        .swg-subscribe-button {
          order: 2;
          background-color: #fff;
          color: #757575;
          border-radius: 1px;
          box-shadow: 0 2px 4px 0 rgba(0,0,0,.25);
          border: none;
          background-image: none;
          white-space: nowrap;
          display: -webkit-box;
          display: -webkit-flex;
          display: -ms-flexbox;
          display: flex;
          -webkit-box-orient: horizontal;
          -webkit-box-direction: normal;
          -webkit-flex-direction: row;
          -ms-flex-direction: row;
          flex-direction: row;
          padding: 8px;
          margin-right: 8px;
        }
      </style>
    `;
  return style;
}

/**
 * Builds and returns the content HTML for the offer dialog.
 * TODO(dparikh): Add offers within the content.
 * @private
 */
function getContent_() {
  return '<div class="swg-content"></div>';
}

/**
 * Builds and returns the footer HTML for the offer dialog.
 * @private
 */
function getFooter_() {
  const footer =
    `
    <div class="swg-footer">
      <div style="flex: 1;"></div>
      <span style="margin-right: 16px; padding-top: 8px;">Sign in</span>
      <button class="swg-subscribe-button" id="swg-subscribe-button">
        <div style="width: 18px; height: 18px;">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="18px" height="18px" viewBox="0 0 48 48" class="abcRioButtonSvg">
              <g>
                <path fill="#EA4335"
                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z">
                </path>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                <path fill="none" d="M0 0h48v48H0z"></path>
              </g>
            </svg>
        </div>
        <span style="margin-left: 8px;">Subscribe with Google</span>
      </button>
    </div>
    `;
  return footer;
}

/**
 * Sets the CSS attributes for the element.
 * @param {!Element} element The new element.
 * @param {number} height The height of the element.
 * @param {string=} important Whether to add important.
 */
export function setCssAttributes(element, height, important = 'important') {
  const elementStyle = element.style;
  elementStyle.setProperty('position', 'fixed', important);
  elementStyle.setProperty('bottom', '0', important);
  elementStyle.setProperty('left', '0', important);
  elementStyle.setProperty('right', '0', important);
  elementStyle.setProperty('z-index', '2147483647', important);
  elementStyle.setProperty('border', 'none', important);
  elementStyle
      .setProperty('box-shadow', '3px 3px gray, 0 0 1.4em gray', important);
  elementStyle.setProperty('background-color', '#fff', important);
  elementStyle.setProperty('box-sizing', 'border-box', important);
  elementStyle.setProperty('display', 'none', important);
  elementStyle.setProperty('min-height', `${height}px`, important);
}
