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

import {Activities} from './activities';
import {ActivityIframePort} from './activity-iframe-port';
import {ActivityIframeHost} from './activity-iframe-host';


describes.realWin('Activities', {}, env => {
  let win, doc;
  let activities;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    activities = new Activities(win);
  });

  describe('openIframe', () => {
    let iframe;
    let connectPromise, connectResolve, connectReject;

    beforeEach(() => {
      iframe = doc.createElement('iframe');
      doc.body.appendChild(iframe);
      connectPromise = new Promise((resolve, reject) => {
        connectResolve = resolve;
        connectReject = reject;
      });
      sandbox.stub(
          ActivityIframePort.prototype,
          'connect',
          () => connectPromise);
    });

    it('should open an iframe and connect', () => {
      const promise = activities.openIframe(
          iframe,
          '/iframe',
          'https://example.com',
          {a: 1});
      connectResolve();
      return promise.then(port => {
        expect(port).to.be.instanceof(ActivityIframePort);
        expect(port.iframe_).to.equal(iframe);
        expect(port.url_).to.equal('/iframe');
        expect(port.args_).to.deep.equal({a: 1});
      });
    });

    it('should open an iframe with no args', () => {
      const promise = activities.openIframe(
          iframe,
          '/iframe',
          'https://example.com');
      connectResolve();
      return promise.then(port => {
        expect(port).to.be.instanceof(ActivityIframePort);
        expect(port.iframe_).to.equal(iframe);
        expect(port.url_).to.equal('/iframe');
        expect(port.args_).to.be.null;
      });
    });

    it('should fail opening an iframe if connect fails', () => {
      const promise = activities.openIframe(
          iframe,
          '/iframe',
          'https://example.com',
          {a: 1});
      connectReject(new Error('intentional'));
      return expect(promise).to.eventually.be.rejectedWith('intentional');
    });
  });

  describe('connectHost', () => {
    let connectPromise, connectResolve, connectReject;

    beforeEach(() => {
      connectPromise = new Promise((resolve, reject) => {
        connectResolve = resolve;
        connectReject = reject;
      });
      sandbox.stub(
          ActivityIframeHost.prototype,
          'connect',
          () => connectPromise);
    });

    it('should connect the host', () => {
      const promise = activities.connectHost();
      connectResolve();
      return promise.then(host => {
        expect(host).to.be.instanceof(ActivityIframeHost);
      });
    });

    it('should fail if connect fails', () => {
      const promise = activities.connectHost();
      connectReject(new Error('intentional'));
      return expect(promise).to.eventually.be.rejectedWith('intentional');
    });
  });
});
