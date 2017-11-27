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
import {parseUrl} from '../utils/url';


describes.fixture('ActivityIframePort integration', {}, env => {
  let fixture;
  let port;

  beforeEach(() => {
    fixture = env.fixture;
    const fixtureUrl = env.fixtureUrl('activity-iframe-host', 'sp');
    port = new ActivityIframePort(
        env.iframe,
        fixtureUrl,
        parseUrl(fixtureUrl).origin,
        {a: 1});
    return Promise.all([fixture.connected(), port.connect()]);
  });

  it('should return "result"', () => {
    fixture.send('return-result', 'abc');
    return port.awaitResult().then(result => {
      expect(result.ok).to.be.true;
      expect(result.data).to.equal('abc');
    });
  });

  it('should return "canceled"', () => {
    fixture.send('return-canceled');
    return port.awaitResult().then(result => {
      expect(result.ok).to.be.false;
      expect(result.code).to.equal(ActivityResultCode.CANCELED);
    });
  });

  it('should return "failed"', () => {
    fixture.send('return-failed', 'broken');
    return port.awaitResult().then(result => {
      expect(result.ok).to.be.false;
      expect(result.code).to.equal(ActivityResultCode.FAILED);
      expect(result.error.message).to.match(/broken/);
    });
  });

  it('should yield "ready"', () => {
    const resizePromise = new Promise(resolve => {
      port.onResizeRequest(resolve);
    });
    fixture.send('return-ready', {height: 112});
    return port.whenReady().then(() => {
      return resizePromise;
    }).then(height => {
      expect(height).to.equal(112);
    });
  });

  it('should handle resize', () => {
    const resizeAckPromise = new Promise(resolve => {
      fixture.on('ack-resize', resolve);
    });
    const resizePromise = new Promise(resolve => {
      port.onResizeRequest(resolve);
    });
    fixture.send('return-ready', {height: 302});
    return port.whenReady().then(() => {
      return resizePromise;
    }).then(() => {
      env.iframe.style.height = '280px';
      port.resized();
      return resizeAckPromise;
    }).then(data => {
      expect(data.allowedHeight >= 280).to.be.true;
      expect(data.requestedHeight).to.equal(302);
      expect(data.overflow).to.be.true;
    });
  });
});
