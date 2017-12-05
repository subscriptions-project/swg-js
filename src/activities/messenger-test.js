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

import {Messenger} from './messenger';


describes.realWin('Messenger', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  describe('port', () => {
    let messenger;
    let source;
    let onCommand;
    let addEventListenerSpy, removeEventListenerSpy;

    beforeEach(() => {
      // A port knows the origin, but doesn't always know the source window.
      source = null;
      messenger = new Messenger(win,
        () => source,
        'https://example-sp.com');
      onCommand = sandbox.spy();
      addEventListenerSpy = sandbox.spy(win, 'addEventListener');
      removeEventListenerSpy = sandbox.spy(win, 'removeEventListener');
      messenger.connect(onCommand);
    });

    it('should now allow connecting twice', () => {
      expect(() => {
        messenger.connect(onCommand);
      }).to.throw(/already connected/);
    });

    it('should add and remove message listener', () => {
      expect(addEventListenerSpy).to.be.calledOnce;
      expect(addEventListenerSpy.args[0][0]).to.equal('message');
      const handler = addEventListenerSpy.args[0][1];
      expect(handler).to.be.a.function;

      // Disconnect.
      messenger.disconnect();
      expect(removeEventListenerSpy).to.be.calledOnce;
      expect(removeEventListenerSpy.args[0][0]).to.equal('message');
      expect(removeEventListenerSpy.args[0][1]).to.equal(handler);
    });

    it('should fail target until connected', () => {
      expect(() => {
        messenger.getTarget();
      }).to.throw(/not connected/);
    });

    it('should succeed target once connected', () => {
      source = {};
      expect(messenger.getTarget()).to.equal(source);
    });

    it('should return origin immediately', () => {
      expect(messenger.getTargetOrigin()).to.equal('https://example-sp.com');
    });

    it('should fail sending a command until connected', () => {
      expect(() => {
        messenger.sendCommand('start', {});
      }).to.throw(/not connected/);
    });

    it('should send a command once connected', () => {
      source = {
        postMessage: sandbox.spy(),
      };
      messenger.sendCommand('start', {a: 1});
      expect(source.postMessage).to.be.calledOnce;
      expect(source.postMessage.args[0][0]).to.deep.equal({
        sentinel: '__ACTIVITIES__',
        cmd: 'start',
        payload: {a: 1},
      });
      expect(source.postMessage.args[0][1]).to.equal('https://example-sp.com');
    });

    it('should call an inbound command', () => {
      const handler = addEventListenerSpy.args[0][1];
      handler({
        origin: 'https://example-sp.com',
        data: {sentinel: '__ACTIVITIES__', cmd: 'connect', payload: {a: 1}},
      });
      expect(onCommand).to.be.calledOnce;
      expect(onCommand.args[0][0]).to.equal('connect');
      expect(onCommand.args[0][1]).to.deep.equal({a: 1});
    });

    it('should ignore an inbound non-conforming message', () => {
      const handler = addEventListenerSpy.args[0][1];
      handler({data: null});
      handler({data: 0});
      handler({data: 10});
      handler({data: ''});
      handler({data: 'abc'});
      handler({data: {}});
      handler({data: {cmd: 'connect'}});
      handler({data: {sentinel: '__OTHER__', cmd: 'connect'}});
      expect(onCommand).to.not.be.called;
    });

    it('should ignore an inbound command for a wrong origin', () => {
      const handler = addEventListenerSpy.args[0][1];
      handler({
        origin: 'https://other-sp.com',
        data: {sentinel: '__ACTIVITIES__', cmd: 'connect'},
      });
      expect(onCommand).to.not.be.called;
    });
  });


  describe('host', () => {
    let messenger;
    let target;
    let onCommand;
    let addEventListenerSpy;

    beforeEach(() => {
      // A host knows the target window, but not the origin.
      target = {
        postMessage: sandbox.spy(),
      };
      messenger = new Messenger(win,
        target,
        /* targetOrigin */ null);
      onCommand = sandbox.spy();
      addEventListenerSpy = sandbox.spy(win, 'addEventListener');
      messenger.connect(onCommand);
    });

    it('should immediately resolve the target', () => {
      expect(messenger.getTarget()).to.equal(target);
    });

    it('should fail to return origin until connected', () => {
      expect(() => {
        messenger.getTargetOrigin();
      }).to.throw(/not connected/);
    });

    it('should disallow other commands before connect', () => {
      expect(() => {
        messenger.sendCommand('other', {});
      }).to.throw(/not connected/);
      expect(target.postMessage).to.not.be.called;
    });

    it('should allow connect without origin', () => {
      messenger.sendCommand('connect');
      expect(target.postMessage).to.be.calledOnce;
      expect(target.postMessage.args[0][0]).to.deep.equal({
        sentinel: '__ACTIVITIES__',
        cmd: 'connect',
        payload: null,
      });
      expect(target.postMessage.args[0][1]).to.equal('*');
    });

    it('should connect and initialize origin', () => {
      const handler = addEventListenerSpy.args[0][1];
      handler({
        origin: 'https://example-sp.com',
        data: {sentinel: '__ACTIVITIES__', cmd: 'start', payload: {a: 1}},
      });
      expect(messenger.getTargetOrigin()).to.equal('https://example-sp.com');
      expect(onCommand).to.be.calledOnce;
      expect(onCommand.args[0][0]).to.equal('start');
      expect(onCommand.args[0][1]).to.deep.equal({a: 1});
    });

    it('should disallow origin initialization w/o connect', () => {
      const handler = addEventListenerSpy.args[0][1];
      handler({
        origin: 'https://example-sp.com',
        data: {sentinel: '__ACTIVITIES__', cmd: 'other', payload: {a: 1}},
      });
      expect(() => {
        messenger.getTargetOrigin();
      }).to.throw(/not connected/);
      expect(onCommand).to.not.be.called;
    });
  });
});
