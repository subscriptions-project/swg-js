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
  if (
    e.data &&
    typeof e.data === 'object' &&
    e.data.role !== role &&
    typeof e.data.type === 'string' &&
    e.data.type.startsWith('RRM_GIS')
  ) {
    log(`Received: ${JSON.stringify(e.data)}`);
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
      clientOptions: {theme: 'dark', lang: 'en'},
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
  const msg = {type: 'RRM_GIS_PING', sessionId, role};
  window.postMessage(msg, '*');
  log(`Sent: ${JSON.stringify(msg)}`);
}

function sendReady() {
  const msg = {type: 'RRM_GIS_READY', sessionId, role};
  window.postMessage(msg, '*');
  log(`Sent: ${JSON.stringify(msg)}`);
}

function sendIdToken(idToken) {
  const msg = {
    type: 'RRM_GIS_ID_TOKEN',
    idToken,
    sessionId,
    role,
  };

  iframe.contentWindow.postMessage(msg, '*');
  log(`Sent to Iframe: ${JSON.stringify(msg)}`);
}
