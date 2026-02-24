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

import {GisLoginFlow} from './gis-login-flow';
import {GlobalDoc} from '../../model/doc';

describes.realWin('GisLoginFlow', (env) => {
  let win;
  let doc;
  let flow;
  let clientOptionsMock;
  let iframe;

  beforeEach(() => {
    win = env.win;
    doc = new GlobalDoc(win);
    clientOptionsMock = {
      gisClientId: 'test-client-id',
      onGisIdToken: sandbox.spy(),
    };
    flow = new GisLoginFlow(doc, clientOptionsMock);

    iframe = doc.createElement('iframe');
    doc.getBody().appendChild(iframe);
    
    // Mock iframe position/dimensions
    Object.defineProperties(iframe, {
      offsetLeft: {value: 100},
      offsetTop: {value: 100},
      offsetWidth: {value: 300},
      offsetHeight: {value: 300},
    });
  });

  afterEach(() => {
    flow.dispose();
  });

  it('should create overlay with correct style', () => {
    const position = {left: 10, top: 10, width: 50, height: 50};
    flow.setOverlay(iframe, position);

    const overlay = doc.getBody().querySelector('div[style*="z-index: 2147483647"]');
    expect(overlay).to.exist;
    expect(overlay.style.left).to.equal('110px'); // 100 + 10
    expect(overlay.style.top).to.equal('110px'); // 100 + 10
    expect(overlay.style.width).to.equal('50px');
    expect(overlay.style.height).to.equal('50px');
    expect(overlay.style.visibility).to.equal('visible');
  });

  it('should hide overlay if clipped out', () => {
    // Position outside iframe bounds
    const position = {left: -200, top: 0, width: 50, height: 50};
    flow.setOverlay(iframe, position);

    const overlay = doc.getBody().querySelector('div[style*="z-index: 2147483647"]');
    expect(overlay).to.exist;
    expect(overlay.style.visibility).to.equal('hidden');
  });

  it('should handle click event', async () => {
    const position = {left: 10, top: 10, width: 50, height: 50};
    flow.setOverlay(iframe, position);
    
    const overlay = doc.getBody().querySelector('div[style*="z-index: 2147483647"]');
    await overlay.click();

    expect(clientOptionsMock.onGisIdToken).to.have.been.calledWith('test-client-id');
  });
  
  it('should use dummy token if gisClientId is missing', async () => {
    clientOptionsMock.gisClientId = undefined;
    flow = new GisLoginFlow(doc, clientOptionsMock);
    
    const position = {left: 10, top: 10, width: 50, height: 50};
    flow.setOverlay(iframe, position);
    
    const overlay = doc.getBody().querySelector('div[style*="z-index: 2147483647"]');
    await overlay.click();

    expect(clientOptionsMock.onGisIdToken).to.have.been.calledWith('dummy_token');
  });
});
