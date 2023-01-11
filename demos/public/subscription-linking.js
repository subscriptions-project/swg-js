/**
 * Copyright 2022 The Subscribe with Google Authors. All Rights Reserved.
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

/* eslint-disable-next-line no-unused-vars */
function linkSubscription() {
  self.SWG_BASIC.push(async (basicSubscriptions) => {
    const outputElement = document.getElementById('link-result');
    const ppidInputElement = document.getElementById('ppid-input');
    const ppid = ppidInputElement.value.trim();
    outputElement./*OK*/ innerText = '';
    const result = await basicSubscriptions.linkSubscription({
      publisherProvidedId: ppid,
    });
    outputElement./*OK*/ innerText = JSON.stringify(result, null, 2);
  });
}

function randomPpid() {
  return String(Math.floor(Math.random() * 1e6));
}

function createForm() {
  const element = document.querySelector('.subscription-linking');
  element./*OK*/ innerHTML = `
  <p>
    <label for="ppid-input">PPID:</label>
    <input type="text" id="ppid-input"/><br/><br/>
    <button onclick="linkSubscription();">Link Subscription</button>
  </p>
  <p>Result</p>
  <code id="link-result" style="white-space: pre"></code>
  `;
}

(async () => {
  createForm();
  const ppid = randomPpid();
  document.getElementById('ppid-input').value = ppid;
})();
