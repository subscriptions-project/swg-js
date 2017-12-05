/**
 * @license
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

import {ActivityIframeHost} from './activity-iframe-host';
import {Timer} from '../utils/timer';


describes.realWin('ActivityIframeHost', {}, env => {
  let win, doc;
  let host;
  let messenger;
  let container;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    host = new ActivityIframeHost(win);
    messenger = host.messenger_;
    container = doc.createElement('div');
    doc.body.appendChild(container);
    host.setSizeContainer(container);
  });

  afterEach(() => {
    messenger.disconnect();
  });

  it('should fail before connected', () => {
    expect(() => {
      messenger.getTarget();
    }).to.throw(/not connected/);
    expect(() => {
      messenger.getTargetOrigin();
    }).to.throw(/not connected/);
  });

  it('should initialize messenger on connect', () => {
    const sendCommandStub = sandbox.stub(messenger, 'sendCommand');
    host.connect();
    expect(messenger.getTarget()).to.equal(win.parent);
    expect(() => {
      messenger.getTargetOrigin();
    }).to.throw(/not connected/);
    expect(() => {
      host.getTargetOrigin();
    }).to.throw(/not connected/);
    expect(() => {
      host.getArgs();
    }).to.throw(/not connected/);
    expect(sendCommandStub).to.be.calledOnce;
    expect(sendCommandStub).to.be.calledWith('connect');
    expect(host.connected_).to.be.false;
    expect(messenger.onCommand_).to.be.a.function;

    // Disconnect.
    const disconnectStub = sandbox.stub(messenger, 'disconnect');
    host.disconnect();
    expect(disconnectStub).to.be.calledOnce;
  });

  describe('commands', () => {
    let connectPromise;
    let onEvent;
    let sendCommandStub;
    let clock;
    let addEventListenerSpy, removeEventListenerSpy;

    beforeEach(() => {
      clock = sandbox.useFakeTimers();
      connectPromise = host.connect();
      onEvent = messenger.handleEvent_.bind(messenger);
      sendCommandStub = sandbox.stub(messenger, 'sendCommand');
      onCommand('start', {a: 1});
    });

    afterEach(() => {
      host.disconnect();
    });

    function onCommand(cmd, payload) {
      onEvent({
        origin: 'https://example-pub.com',
        data: {
          sentinel: '__ACTIVITIES__',
          cmd,
          payload,
        },
      });
    }

    it('should handle "start" and "close"', () => {
      const disconnectStub = sandbox.stub(host, 'disconnect');
      return connectPromise.then(() => {
        expect(messenger.getTarget()).to.equal(win.parent);
        expect(host.getTargetOrigin()).to.equal('https://example-pub.com');
        expect(host.getArgs()).to.deep.equal({a: 1});
        expect(host.connected_).to.be.true;

        expect(disconnectStub).to.not.be.called;
        onCommand('close');
        expect(disconnectStub).to.be.calledOnce;
      });
    });

    it('should yield "result"', () => {
      const disconnectStub = sandbox.stub(host, 'disconnect');
      host.result('abc');
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('result', {
        code: 'ok',
        data: 'abc',
      });
      // Do not disconnect, wait for "close" message to ack the result receipt.
      expect(disconnectStub).to.not.be.called;
    });

    it('should yield "result" with null', () => {
      host.result(null);
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('result', {
        code: 'ok',
        data: null,
      });
    });

    it('should yield "canceled"', () => {
      const disconnectStub = sandbox.stub(host, 'disconnect');
      host.cancel();
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('result', {
        code: 'canceled',
        data: null,
      });
      expect(disconnectStub).to.not.be.called;
    });

    it('should yield "failed"', () => {
      const disconnectStub = sandbox.stub(host, 'disconnect');
      host.failed(new Error('broken'));
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('result', {
        code: 'failed',
        data: 'Error: broken',
      });
      expect(disconnectStub).to.not.be.called;
    });

    it('should send "ready" signal', () => {
      addEventListenerSpy = sandbox.spy(win, 'addEventListener');
      removeEventListenerSpy = sandbox.spy(win, 'removeEventListener');
      container.style.height = '111px';

      // Ready.
      host.ready();
      expect(sendCommandStub).to.be.calledTwice;
      expect(sendCommandStub).to.be.calledWith('ready');
      expect(sendCommandStub).to.be.calledWith('resize', {height: 111});
      expect(addEventListenerSpy).to.be.calledOnce;
      expect(addEventListenerSpy).to.be.calledWith('resize');
      expect(removeEventListenerSpy).to.not.be.called;

      // Disconnect.
      host.disconnect();
      expect(removeEventListenerSpy).to.be.calledTwice;  // Additional call for "message" event.
      expect(removeEventListenerSpy).to.be.calledWith('resize');
    });

    it('should handle "resized"', () => {
      const callback = sandbox.spy();
      host.onResizeComplete(callback);
      expect(callback).to.not.be.called;

      container.style.height = '311px';
      host.resized();
      clock.tick(100);
      onCommand('resized', {height: 311});
      expect(callback).to.be.calledOnce;
      expect(callback).to.be.calledWith(
          /* allowedHeight */ 311,
          /* requestedHeight */ 311,
          /* overfow */ false);
    });

    it('should handle "resized" with underflow', () => {
      const callback = sandbox.spy();
      host.onResizeComplete(callback);
      expect(callback).to.not.be.called;

      container.style.height = '311px';
      host.resized();
      clock.tick(100);
      onCommand('resized', {height: 312});
      expect(callback).to.be.calledOnce;
      expect(callback).to.be.calledWith(
          /* allowedHeight */ 312,
          /* requestedHeight */ 311,
          /* overfow */ false);
    });

    it('should handle "resized" with overflow', () => {
      const callback = sandbox.spy();
      host.onResizeComplete(callback);
      expect(callback).to.not.be.called;

      container.style.height = '311px';
      host.resized();
      clock.tick(100);
      onCommand('resized', {height: 300});
      expect(callback).to.be.calledOnce;
      expect(callback).to.be.calledWith(
          /* allowedHeight */ 300,
          /* requestedHeight */ 311,
          /* overfow */ true);
    });

    it('should react to window size changes', () => {
      host.ready();
      expect(host.lastMeasuredWidth_).to.equal(0);
      sendCommandStub.reset();
      expect(sendCommandStub).to.not.be.called;
      env.iframe.style.width = `${env.iframe.offsetWidth + 20}px`;
      container.style.height = '111px';
      let iterCount = 0;
      const realTimer = new Timer(win);
      return realTimer.poll(100, () => {
        iterCount++;
        if (iterCount == 1) {
          clock.tick(100);
        }
        return sendCommandStub.callCount > 0;
      }).then(() => {
        expect(sendCommandStub).to.be.calledOnce;
        expect(sendCommandStub).to.be.calledWith('resize', {height: 111});
      });
    });
  });
});
