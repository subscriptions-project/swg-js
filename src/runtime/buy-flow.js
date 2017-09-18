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

const PRIMARY_COLOR = '#6D34D3';
const ACCENT_COLOR = '#4A16A8';

var bootstrap = payments.business.integration.bootstrap;
var embedded = payments.business.integration.mashupMode.embedded;
var popup = payments.business.integration.mashupMode.popup;
var standaloneContextAuthId = payments.business.integration.standaloneContextAuthId;
var Style = payments.business.integration.Style;

var dataCallback = function (data) {
  if (data.integratorData) {
      console.log('integratorData: ' + data.integratorData);
      // immediately charge the purchase
      charge(data.integratorData);
  } else {
      console.log('No integratorData');
  }
};

var successCallback = function () {
  console.log('Success');
};
var failureCallback = function (e) {
  console.log('Failure: ' + e);
};

/**
 * Post the buy flow response to the server.
 */
function charge(data) {
  var url = 'charge';
  // Send a request to initiate the funds guarantee request.
  goog.net.XhrIo.send(url, function() {
    var responseText = this.getResponseText();
    // Strip extra line from response
    var responseJson = responseText.substring(responseText.indexOf('\n') + 1);
    console.log(responseJson);
  }, 'POST', 'integratorData=' + encodeURIComponent(data));
}


export class BuyFlow {

  /**
   * @param {string} blob
   * @return {!Promise<???>}
   */
  start(blob) {
    var displayMode = 'embedded';
    var fundsGuarantee = 'AFNo2jOiDCFiJ70NKNbuWTJ_LCsGxY6s0XETWZXg7p7OE7eK3ZySHZ4c1H5kEWP7zbUH1l_7d9C0rYmFukKBUTYAVwWoM2J-FjzagPS02sdIPZSbMlJn_SFQBYt_rFUzljbJ87ujwME71ksayxcoNNzAy0su13SuKoCf2mJvOz85vuC0c81dIlLOGI3adMdEX-jt5Pg_dh9C-8tH9LgX0yB_ATjlw9p7-hY9dW_YV8vuuPjXNfsKI0RLFNW0K0oE5n1mCSAJQTFCJdopJv7Y-OV0Xg9ydOVEIuSQMEWYpqhJqhiOj3Spbd2natfokLVm593wF2mFjydVbf8LV8sU_UhQs-EbCCEe9_hdsCfXScB07ChugsVWjxuGiLcaLvAoOFMT7Z_frKKyiIy_F75a8IKXtIbJFOzdVPmvuwzrlGs0_htONdOm-9twVQTELHS9MfX24XTWuog-';

    var buyFlowStyle = Style.create()
      .withMaterialDesignStyle()
      .setPrimaryColor(PRIMARY_COLOR)
      .setAccentColor(ACCENT_COLOR);

    var buyFlow = bootstrap.asMashupMode(displayMode == 'popup' ?
            popup('buyFlowDivId').usingPreferredWidth('508px') :
            embedded('purchase_container'))
        .usingLocale('en-US')
        .usingGaiaIndex(0)
        .usingStyle(buyFlowStyle.toString())
        .usingDefaultActivityStatusChangeHandler()
        .inStandaloneContext(standaloneContextAuthId.forGaia())
        .buyFlow(dataCallback)
        .withEncryptedParameters(fundsGuarantee)
        .load(successCallback, failureCallback);

    /*
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.bottom = '0';
    iframe.style.left = '0';
    iframe.style.right = '0';
    iframe.style.width = '100%';
    iframe.style.height = '200px';
    iframe.src = 'https://payments.google.com/iframe?blob=' + blob;
    iframe.srcdoc = 'It works!';
    document.body.appendChild(iframe);
    */

    // Protocols w/iframe:
    // 1. Ready
    // 2. Resize
    // 3. Return response

    // return ????
  }

}

