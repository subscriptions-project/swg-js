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

import {ActivityIframePort} from './activity-iframe-port';
import {ActivityResultCode} from './activity-types';


describes.realWin('ActivityIframePort', {}, env => {
  let win, doc;
  let iframe;
  let port;
  let messenger;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    iframe = doc.createElement('iframe');
    doc.body.appendChild(iframe);
    port = new ActivityIframePort(
        iframe,
        'https://example-sp.com/iframe',
        'https://example-sp.com',
        {a: 1});
    messenger = port.messenger_;
  });

  afterEach(() => {
    messenger.disconnect();
  });

  it('should require that iframe is in DOM', () => {
    doc.body.removeChild(iframe);
    expect(() => {
      port.connect();
    }).to.throw(/must be in DOM/);
  });

  it('should set iframe source and initiate messenger', () => {
    expect(iframe.src).to.equal('');
    const promise = port.connect();
    expect(promise.then).to.be.a.function;
    expect(iframe.src).to.equal('https://example-sp.com/iframe');
    expect(messenger.onCommand_).to.be.a.function;
  });

  it('should disconnect messenger', () => {
    messenger.onCommand_ = function() {};
    port.connected_ = true;
    port.disconnect();
    expect(port.connected_).to.be.false;
    expect(messenger.onCommand_).to.be.null;
  });

  describe('commands', () => {
    let connectPromise;
    let onCommand;
    let sendCommandStub;

    beforeEach(() => {
      connectPromise = port.connect();
      onCommand = messenger.onCommand_;
      sendCommandStub = sandbox.stub(messenger, 'sendCommand');
    });

    afterEach(() => {
      port.disconnect();
    });

    it('should handle "connect"', () => {
      onCommand('connect');
      expect(port.connected_).to.be.true;
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('start', {a: 1});
      return connectPromise;
    });

    it('should handle successful "result"', () => {
      port.connected_ = true;
      onCommand('result', {code: 'ok', data: 'success'});
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('close');
      return port.awaitResult().then(result => {
        expect(result.ok).to.be.true;
        expect(result.code).to.equal(ActivityResultCode.OK);
        expect(result.data).to.equal('success');
        expect(port.connected_).to.be.false;
      });
    });

    it('should handle cancel "result"', () => {
      port.connected_ = true;
      onCommand('result', {code: 'canceled', data: null});
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('close');
      return port.awaitResult().then(result => {
        expect(result.ok).to.be.false;
        expect(result.code).to.equal(ActivityResultCode.CANCELED);
        expect(result.data).to.be.null;
        expect(port.connected_).to.be.false;
      });
    });

    it('should handle failed "result"', () => {
      port.connected_ = true;
      onCommand('result', {code: 'failed', data: 'broken'});
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('close');
      return port.awaitResult().then(result => {
        expect(result.ok).to.be.false;
        expect(result.code).to.equal(ActivityResultCode.FAILED);
        expect(result.error).to.be.instanceof(Error);
        expect(result.error.message).to.match(/broken/);
        expect(result.data).to.be.null;
        expect(port.connected_).to.be.false;
      });
    });

    it('should handle "ready"', () => {
      port.connected_ = true;
      onCommand('ready');
      return port.whenReady().then(() => {
        expect(sendCommandStub).to.not.be.called;
        expect(port.connected_).to.be.true;
      });
    });

    it('should handle "resize" before callback is added', () => {
      port.connected_ = true;
      onCommand('resize', {height: 111});
      return new Promise(resolve => {
        port.onResizeRequest(resolve);
      }).then(height => {
        expect(height).to.equal(111);
        expect(port.connected_).to.be.true;
      });
    });

    it('should handle "resize" after callback is added', () => {
      port.connected_ = true;
      const resizeSpy = sandbox.spy();
      port.onResizeRequest(resizeSpy);
      onCommand('resize', {height: 111});
      expect(resizeSpy).to.be.calledOnce;
      expect(resizeSpy).to.be.calledWith(111);
    });

    it('should respond with "resized"', () => {
      port.connected_ = true;
      port.resized();
      expect(sendCommandStub).to.be.calledOnce;
      expect(sendCommandStub).to.be.calledWith('resized',
          {height: iframe.offsetHeight});
    });

    it('should ignore "resized" before connected', () => {
      port.resized();
      expect(sendCommandStub).to.not.be.called;
    });
  });
});
