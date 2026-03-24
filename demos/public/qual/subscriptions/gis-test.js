/* eslint-disable */
/**
 * Copyright 2026 The Subscribe with Google Authors. All Rights Reserved.
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

function init() {
  window.addEventListener('message', messageHandler);
}

function messageHandler(e) {
  if (typeof e.data.type === 'string' && e.data.type.startsWith('RRM_GIS')) {
    log(JSON.stringify(e.data));
  }
}

function initGis() {
  google.accounts.id.initialize({
    client_id: '365425805315-ulc9hop6lvq3blgc7ubvtcu5322t3fcn.apps.googleusercontent.com',
    callback: gisCallback,
    rrm_interop: true,
    rrm_iframe_path: 'https://subscribe-qual.sandbox.google.com/swg/ui/v1/rrmgisinterop'
  });
  google.accounts.id.renderButton(document.getElementById('gisButton'), {
    type: 'standard',
    theme: 'light',
    size: 'large',
  });
  log(`Called initGis`);
}

function gisCallback(response) {
  log(`gisCallback ${JSON.stringify(response)}`);
}

function initRrm() {
  const isAccessibleForFree = document.getElementById('isAccessibleForFree').checked;
  (self.SWG_BASIC = self.SWG_BASIC || []).push((basicSubscriptions) => {
    basicSubscriptions.setOnEntitlementsResponse((response) => {
      log(`Entitlements response: ${JSON.stringify(response)}`);
    });
    basicSubscriptions.init({
      type: "NewsArticle",
      isPartOfType: ["Product"],
      isPartOfProductId: "CAowwoSCAQ:basic",
      isAccessibleForFree: isAccessibleForFree,
      clientOptions: {
        theme: "light",
        lang: "en",
      },
      gisInterop: true,
    });
  });
  log(`Called initRrm with isAccessibleForFree: ${isAccessibleForFree}`);
}

function showOneTap() {
  google.accounts.id.prompt();
}

function addIframe() {
  const container = document.getElementById('iframeContainer');
  const iframe = document.createElement('iframe');

  const url = new URL(window.location.href);
  url.searchParams.set('framed', '1');
  url.protocol = 'http:';
  url.port = '8000';
  url.hostname = url.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  iframe.src = url.toString();
  iframe.style.width = '100%';
  iframe.style.height = '400px';
  iframe.style.border = '2px dashed #999';
  iframe.style.marginTop = '20px';
  iframe.allow = 'identity-credentials-get';
  container.appendChild(iframe);
}

function log(msg) {
  const logDiv = document.getElementById('gisLog');
  const div = document.createElement('div');
  div.textContent = msg;
  logDiv.appendChild(div);
  logDiv.scrollTop = logDiv.scrollHeight;
}
