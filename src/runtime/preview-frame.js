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

export const PREVIEW_FRAME_JS = `
  const SENTINEL = "SWGPREV"
  function clickHandler(event) {
    if (!event.target.id) {
      return;
    }

    let message = {
      sentinel: SENTINEL,
      type: event.type,
      target: event.target.id,
    };
    console.log(message);
    window.parent.postMessage(message, '*');
  }
  window.addEventListener('click',clickHandler);
`;

export const PREVIEW_FRAME_STYLE = `
body {
  padding: 5px 0 5px;
  font-family: sans-serif;
  line-height: 1.3;
  max-height: 100vh;
  font-size: 14px;
}
.menu {margin: 5px 5px 0 5px }
.header { text-align: center; font-weight: bold; padding: 0 5px 0 5px; color: #444  }
.clickable { cursor: pointer; }
.menuItem {     
  padding: 3px 8px 2px 8px;
  color: #444;
  margin: 0 3px 0 3px;
  background: #fff;
  border: none;
  border-bottom: 2px transparent;

}
.menuItem:hover {
  background: #eee;
  border-bottom: 2px solid #eee;
}
.active, .active:hover {     
  color: #000;
  border-bottom: 2px solid blue;
}
.hidden { display: none }
.expand #tidy, .show { display: block }
#dataPane { border-top: 1px solid #ccc; overflow: scroll;  position: fixed; top: 53px; bottom: 0; 
width: 100%;  }
#dataPane > div { padding: 5px 0 0 5px }
#tidy {     
  position: fixed;
  top: 25px;
  right: 3px;
  font-size: 36px;
  height: 25px;
  display: none;
 }
 #close { float: right; padding-right 5px}
.placeholder { margin: 15px 0 15px; text-align: center; font-weight: bold;}
pre { margin: 0.5em 0; font-size: 12px };

`;

export const PREVIEW_FRAME_HTML = `
  <div class="header">
    Reader Revenue Dev Tools
    <span id="close" class="clickable">&#x2715</span>
  </div>
  <div class=menu>
    <button class="menuItem clickable" id="prev">Previews</button>
    <button class="menuItem clickable" id="conf">Config</button>
    <button class="menuItem clickable" id="ents">Entitlements</button>
  </div>
  <div id="dataPane">
    <div class="hidden" id="confData">
      <div>On page config:</div>
      <pre id="pageConfig">
      
      </pre>
      <div>Config from server:</div>
      <pre id="clientConfig"> Loading ... </pre>
    </div>
    <div class="hidden" id="entsData">
      <div>Entitlement response from server:</div>
      <pre id="entitmentDetail">Fetching entitlments ...</pre>
    </div>
    <div class="hidden" id="prevData">
      <div>Available Previews</div>
      <ol class="prevMenu"> 
        <li><button id="subscription">Show Paywall</button></li>
        <li><button id="contribution">Show Contributions</button></li>
      </ol>
      <div id="previewResult" class="hidden">
        <div>Requested Transaction</div>
        <pre id="previewResultData"></pre>
      </div>
    </div>
    <div id="tidy" class="clickable">&#708;</div>
  </div>
`;
