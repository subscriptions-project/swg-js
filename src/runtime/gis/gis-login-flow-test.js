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

import {
  ElementCoordinates,
  GisSignIn,
  LoginButtonCoordinates,
} from '../../proto/api_messages';
import {GisLoginFlow} from './gis-login-flow';
import {getStyle} from '../../utils/style';

describes.realWin('GisLoginFlow', (env) => {
  let doc;
  let win;
  let activityIframeView;
  let gisLoginFlow;
  let messageMap;
  let message;

  beforeEach(() => {
    const coordinates = new ElementCoordinates();

    coordinates.setId('1');
    coordinates.setLeft(10);
    coordinates.setTop(10);
    coordinates.setWidth(100);
    coordinates.setHeight(30);

    message = new LoginButtonCoordinates();
    message.setLoginButtonCoordinatesList([coordinates]);

    messageMap = {};

    win = env.win;
    sandbox.stub(win, 'addEventListener').callThrough();
    sandbox.stub(self, 'requestAnimationFrame').callsFake((cb) => {
      cb();
      return 1;
    });
    sandbox.stub(self, 'cancelAnimationFrame');

    doc = {
      getWin: () => win,
      getRootNode: () => win.document,
      getBody: () => win.document.body,
    };

    const el = win.document.createElement('iframe');
    sandbox.stub(el, 'getBoundingClientRect').returns({
      width: 500,
      height: 500,
      left: 0,
      top: 0,
      right: 500,
      bottom: 500,
    });

    activityIframeView = {
      on: (ctor, cb) => {
        const messageType = new ctor();
        const messageLabel = messageType.label();
        messageMap[messageLabel] = cb;
      },
      getElement: () => el,
      execute: sandbox.spy(),
    };

    gisLoginFlow = new GisLoginFlow(doc, 'client-id', activityIframeView);
  });

  afterEach(() => {
    gisLoginFlow.dispose();
    delete self.google;
  });

  it('listens for resize events on the window', () => {
    expect(win.addEventListener).to.have.been.calledWith('resize');
  });

  it('creates an overlay bounds on message and styles it appropriately', () => {
    win.innerWidth = 1000;
    win.innerHeight = 1000;

    messageMap[message.label()](message);

    const overlays = win.document.body.querySelectorAll('div');
    expect(overlays.length).to.equal(1);

    // iframe is 500x500. Inner window is 1000x1000.
    // offsetLeft = (1000 - 500) / 2 + 10 = 250 + 10 = 260
    // offsetTop = 1000 - (500 - 10) = 1000 - 490 = 510
    expect(getStyle(overlays[0], 'left')).to.equal('260px');
    expect(getStyle(overlays[0], 'top')).to.equal('510px');
    expect(getStyle(overlays[0], 'width')).to.equal('100px');
    expect(getStyle(overlays[0], 'height')).to.equal('30px');
  });

  it('ignores invalid coordinate payload', () => {
    const message = new LoginButtonCoordinates();
    message.setLoginButtonCoordinatesList([new ElementCoordinates()]);

    messageMap[message.label()](message);

    const overlays = win.document.body.querySelectorAll('div');
    expect(overlays.length).to.equal(0);
  });

  it('calls login when overlay is clicked and invokes the callback', async () => {
    messageMap[message.label()](message);

    const overlay = win.document.body.querySelector('div');

    self.google = {
      accounts: {
        id: {
          prompt: () => {},
          initialize: (config) => {
            config.callback({credential: 'fakeIdToken'});
          },
        },
      },
    };

    await overlay.onclick();

    await 1;

    const gisSignIn = new GisSignIn();
    gisSignIn.setIdToken('fakeIdToken');
    gisSignIn.setGisClientId('client-id');
    expect(activityIframeView.execute).to.have.been.calledWith(gisSignIn);
  });

  it('cancels existing requestAnimationFrame on scheduleUpdate', () => {
    sandbox.restore();
    sandbox.stub(self, 'requestAnimationFrame').returns(123);
    const cancelAnimationFrameSpy = sandbox.spy(self, 'cancelAnimationFrame');

    messageMap[message.label()](message);

    expect(cancelAnimationFrameSpy).to.have.not.been.called;

    messageMap[message.label()](message);

    expect(cancelAnimationFrameSpy).to.have.been.called;
  });
});
