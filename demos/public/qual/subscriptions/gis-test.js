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

const clientId =
  '365425805315-ulc9hop6lvq3blgc7ubvtcu5322t3fcn.apps.googleusercontent.com';
const sessionId = 'test-session-123';
const role = 'GIS';

let iframe = null;
let logDiv = null;

function init() {
  initLog();
  initGis();
  initSwg();
  initIframe();
}

function initLog() {
  logDiv = document.getElementById('gisLog');
  window.addEventListener('message', messageHandler);
}

function messageHandler(e) {
  if (typeof e.data.type === 'string' && e.data.type.startsWith('RRM_GIS')) {
    log(JSON.stringify(e.data));
  }
}

function initGis() {
  google.accounts.id.initialize({
    client_id: clientId,
    callback: gisCallback,
  });
}

function gisCallback(response) {
  sendIdToken(response.credential);
}

function initSwg() {
  (self.SWG_BASIC = self.SWG_BASIC || []).push((basicSubscriptions) => {
    basicSubscriptions.init({
      type: 'NewsArticle',
      isAccessibleForFree: false,
      isPartOfType: ['Product'],
      isPartOfProductId: 'CAow37yEAQ:basic',
      autoPromptType: 'subscription',
      clientOptions: { theme: 'dark', lang: 'en' },
      gisInterop: true,
    });
  });
}

function initIframe() {
  iframe = document.createElement('iframe');
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.display = 'none';

  const url = new URL(
    'https://subscribe-qual.sandbox.google.com/swg/ui/v1/rrmgisinterop'
  );
  url.searchParams.append('sessionId', sessionId);
  url.searchParams.append('origin', window.location.origin);
  url.searchParams.append('rrmOrigin', window.location.origin);
  url.searchParams.append('gisOrigin', window.location.origin);
  url.searchParams.append('role', role);

  iframe.src = url.toString();
  document.body.appendChild(iframe);
}

function showOneTap() {
  google.accounts.id.prompt();
}

function log(msg) {
  const div = document.createElement('div');
  div.textContent = msg;
  logDiv.appendChild(div);
  logDiv.scrollTop = logDiv.scrollHeight;
}

function sendPing() {
  const msg = { type: 'RRM_GIS_PING', sessionId };
  window.postMessage(msg, '*');
  log(`Sent: ${JSON.stringify(msg)}`);
}

function sendReady() {
  const msg = { type: 'RRM_GIS_READY_GIS', sessionId };
  window.postMessage(msg, '*');
  log(`Sent: ${JSON.stringify(msg)}`);
}

function sendIdToken(idToken) {
  const msg = {
    type: 'RRM_GIS_ID_TOKEN',
    idToken,
    sessionId,
  };

  iframe.contentWindow.postMessage(msg, '*');
  log(`Sent to Iframe: ${JSON.stringify(msg)}`);
}
