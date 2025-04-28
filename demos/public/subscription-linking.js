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

function getInputValue(inputName) {
  return document.getElementById(inputName).value.trim();
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function linkSubscription() {
  self.SWG.push(async (subscriptions) => {
    const outputElement = document.getElementById('link-result');
    outputElement./*OK*/ innerText = '';
    const result = await subscriptions.linkSubscription({
      publisherProvidedId: getInputValue('ppid-input1'),
    });
    outputElement./*OK*/ innerText = JSON.stringify(result, null, 2);
  });
}

/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function linkSubscriptions() {
  self.SWG.push(async (subscriptions) => {
    const outputElement = document.getElementById('link-result');
    const linkTo = [
      {
        publicationId: getInputValue('publication-id-input1'),
        publisherProvidedId: getInputValue('ppid-input1'),
      },
      {
        publicationId: getInputValue('publication-id-input2'),
        publisherProvidedId: getInputValue('ppid-input2'),
      },
    ];
    outputElement./*OK*/ innerText = '';
    const result = await subscriptions.linkSubscriptions({linkTo});
    outputElement./*OK*/ innerText = JSON.stringify(result, null, 2);
  });
}

function randomPpid() {
  return String(Math.floor(Math.random() * 1e6));
}

function getLabeledInput(label, id) {
  return `<label for="${id}">${label}</label><input type="text" id="${id}"/>`;
}

function createForm() {
  const element = document.querySelector('.subscription-linking');
  element./*OK*/ innerHTML = `
  <p>
    ${getLabeledInput('Link 1 PPID:', 'ppid-input1')}<br/><br/>
    <button onclick="linkSubscription();">Link 1 Subscription</button><br/><br/>
    ${getLabeledInput('Link1 Publication:', 'publication-id-input1')}
    <span>Required if linking 2 subscriptions</span><br/><br/>
    ${getLabeledInput('Link2 Publication:', 'publication-id-input2')}<br/><br/>
    ${getLabeledInput('Link2 PPID:', 'ppid-input2')}<br/><br/>
    <button onclick="linkSubscriptions();">Link 2 Subscriptions</button>
    <span>Please note the publications must be on the same organization.</span>
  </p>
  <p>Result</p>
  <code id="link-result" style="white-space: pre"></code>
  `;
}

(async () => {
  createForm();
  document.getElementById('ppid-input1').value = randomPpid();
  document.getElementById('ppid-input2').value = randomPpid();
})();
