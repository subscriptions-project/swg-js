/**
 * Copyright 2024 The Subscribe with Google Authors. All Rights Reserved.
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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {AddPreferredSourceButtonIframe} from './add-preferred-source-button-iframe';

describes.realWin('AddPreferredSourceButtonIframe', (env) => {
  let win;
  let doc;
  let deps;
  let activityPorts;
  let iframeComponent;
  let container;
  let portStub;

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;

    portStub = sandbox.createStubInstance(ActivityIframePort);
    portStub.onResizeRequest.callsFake((cb) => {
      // simulate resize
      cb(200);
    });
    portStub.whenReady.resolves();
    portStub.acceptResult.resolves(true);

    activityPorts = sandbox.createStubInstance(ActivityPorts);
    activityPorts.openIframe.resolves(portStub);

    deps = {
      doc: () => ({getWin: () => win}),
      activities: () => activityPorts,
    };

    container = doc.createElement('div');
    doc.body.appendChild(container);

    iframeComponent = new AddPreferredSourceButtonIframe(deps, container, {
      lang: 'en',
      theme: 'dark',
    });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should attach iframe to container', async () => {
    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    const iframe = container.querySelector('iframe');
    expect(iframe).to.not.be.null;
    expect(iframe.style.height).to.equal('200px'); // Resized

    expect(activityPorts.openIframe).to.have.been.calledOnce;
    expect(resultCalled).to.be.true;
  });

  it('should handle iframe rejected results silently', async () => {
    portStub.acceptResult.resolves(false); // Does not call onResult
    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    expect(resultCalled).to.be.false;
  });

  it('should gracefully handle openIframe exceptions', async () => {
    activityPorts.openIframe.rejects(new Error('Blocked!'));

    let resultCalled = false;
    await iframeComponent.attach(() => {
      resultCalled = true;
    });

    expect(resultCalled).to.be.false; // Exception handled gracefully in attach
  });
});
