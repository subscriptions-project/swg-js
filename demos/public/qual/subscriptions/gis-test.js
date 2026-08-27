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
    client_id: '185085492387-b0okt68p1rc83qo530a8kruou8mf5gfj.apps.googleusercontent.com',
    callback: gisCallback,
    rrm_interop: true,
    rrm_iframe_path: 'https://subscribe-qual.sandbox.google.com/swg/ui/v1/rrmgisinterop'
  });
  google.accounts.id.renderButton(document.getElementById('gisButton'), {
    type: 'standard',
    theme: 'light',
    size: 'large',
  });
  // Testing the overlap issue between regwall and One Tap popup.
  google.accounts.id.prompt();
  log(`Called initGis`);
}

let isEnterprise = false;

function gisCallback(response) {
  log(`gisCallback ${JSON.stringify(response)}`);

  if (response.credential) {
    const callback = (subscriptions) => {
      subscriptions
        .processGisCredential(response, {
          gisClientId:
            '185085492387-b0okt68p1rc83qo530a8kruou8mf5gfj.apps.googleusercontent.com',
        })
        .then(({fromRrm}) => {
          if (fromRrm) {
            log('Handled as Regwall completion');
          } else {
            log('Handled as normal login or One Tap');
          }
        });
    };

    if (isEnterprise) {
      (self.SWG = self.SWG || []).push(callback);
    } else {
      (self.SWG_BASIC = self.SWG_BASIC || []).push(callback);
    }
  }
}

function initEnterprise() {
  isEnterprise = true;
  (self.SWG = self.SWG || []).push(async (subscriptions) => {
    try {
      subscriptions.configure({
        gisInterop: true,
      });
      subscriptions.setOnEntitlementsResponse((entitlementsPromise) => {
        entitlementsPromise
          .then((entitlements) => {
            log(`Entitlements response: ${JSON.stringify(entitlements.json())}`);
            log(`Enables this: ${entitlements.enablesThis()}`);
          })
          .catch((error) => {
            log(`Entitlements error: ${error}`);
          });
      });
      subscriptions.init('CAow8vGLAQ');
      log('Called initEnterprise with CAow8vGLAQ');

      log('Fetching available interventions...');
      const availableInterventions =
        await subscriptions.getAvailableInterventions();
      log(
        `Available interventions count: ${availableInterventions ? availableInterventions.length : 'null'
        }`
      );
      if (availableInterventions && availableInterventions.length > 0) {
        availableInterventions.forEach((item, index) => {
          log(
            `[${index}] type=${item.type}, configurationId=${item.configurationId}`
          );
        });
      }

      const intervention = availableInterventions?.find(
        (item) => item.configurationId === 'dab3eda7-3689-437d-a54b-141e10ad0c0d'
      );
      if (intervention) {
        log('Displaying CTA for dab3eda7-3689-437d-a54b-141e10ad0c0d');
        intervention.show({
          isClosable: true,
          onResult: (result) => {
            log(`Intervention result: ${JSON.stringify(result)}`);
          },
        });
      } else {
        log('Intervention dab3eda7-3689-437d-a54b-141e10ad0c0d not found');
      }
    } catch (error) {
      log(`Error in initEnterprise: ${error.message || error}`);
    }
  });
}

function initRrm() {
  isEnterprise = false;
  const isAccessibleForFree = document.getElementById('isAccessibleForFree').checked;
  (self.SWG_BASIC = self.SWG_BASIC || []).push((basicSubscriptions) => {
    basicSubscriptions.setOnEntitlementsResponse((entitlementsPromise) => {
      entitlementsPromise
        .then((entitlements) => {
          log(`Entitlements response: ${JSON.stringify(entitlements.json())}`);
          log(`Enables this: ${entitlements.enablesThis()}`);
        })
        .catch((error) => {
          log(`Entitlements error: ${error}`);
        });
    });
    basicSubscriptions.init({
      type: "NewsArticle",
      isPartOfType: ["Product"],
      isPartOfProductId: "CAowhbqJAQ:product1",
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
