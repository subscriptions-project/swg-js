/**
 * @license
 * Copyright 2018 Google Inc. All Rights Reserved.
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

import {Constants} from './constants.js';

/**
 * Injects the provided style sheet to the document head.
 * @param {string} styleText The stylesheet to be injected.
 * @return {!Element}
 */
function injectStyleSheet(styleText) {
  const styleElement = document.createElement('style');
  styleElement.type = 'text/css';
  styleElement.textContent = styleText;
  document.head.appendChild(styleElement);
  return styleElement;
}

/**
 * Injects the pay with google iframe.
 * @param {string} iframeClassName The classname of the iFrame wrapper.
 * @return {!{container: !Element, iframe:!HTMLIFrameElement}}
 */
function injectIframe(iframeClassName) {
  const container = document.createElement('div');
  container.classList.add(Constants.IFRAME_CONTAINER_CLASS);
  const iframeContainer = document.createElement('div');
  iframeContainer.classList.add('iframeContainer');
  /** @private @const {!HTMLIFrameElement} */
  const iframe =
      /** @type {!HTMLIFrameElement} */ (document.createElement('iframe'));
  iframe.classList.add(iframeClassName);
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('scrolling', 'no');
  iframeContainer.appendChild(iframe);
  container.appendChild(iframeContainer);
  document.body.appendChild(container);
  return {'container': container, 'iframe': iframe};
}

export {
  injectStyleSheet,
  injectIframe,
};
