/**
 * Copyright 2018 The Subscribe with Google Authors. All Rights Reserved.
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
  ActivityPorts as WebActivityPorts,
  ActivityIframePort as WebActivityIframePort,
  ActivityPort as WebActivityPort,
  ActivityMode,
  ActivityResult,
} from 'web-activities/activity-ports';
import {ActivityPorts, ActivityIframePort} from './activities';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import {AnalyticsRequest, AnalyticsEvent} from '../proto/messages';

describes.realWin('ActivityPorts test', {}, env => {
  let win, iframe, url, dialog, doc;

  beforeEach(() => {
    win = env.win;
    url = '/hello';
    doc = new GlobalDoc(win);
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    iframe = dialog.getElement();
    doc.getBody().appendChild(iframe);
  });

  afterEach(() => {});

  describe('test delegation', () => {
    it('should delegate openIframe to ActivityIframePort', () => {
      const activityPorts = new ActivityPorts(win);
      sandbox
        .stub(ActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      return activityPorts.openIframe(iframe, url).then(port => {
        expect(port instanceof ActivityIframePort).to.be.true;
      });
    });

    it('should delegate open', () => {
      const activityPorts = new ActivityPorts(win);
      sandbox.stub(WebActivityPorts.prototype, 'open').callsFake(() => {
        return {targetWin: null};
      });
      const opener = activityPorts.open(
        'some_request_id',
        '/someUrl',
        '_top',
        {}
      );
      expect(opener.targetWin).to.be.null;
    });

    it('must delegate onResult', () => {
      const activityPorts = new ActivityPorts(win);
      const resultHandler = portDef => {
        return portDef.acceptResult().then(result => {
          expect(result.data).to.deep.equal('test');
        });
      };
      let cb;
      sandbox
        .stub(WebActivityPorts.prototype, 'onResult')
        .callsFake((requestId, handler) => {
          expect(requestId).to.equal('result');
          cb = handler;
        });
      activityPorts.onResult('result', resultHandler);
      const activityPort = new WebActivityPort();
      activityPort.acceptResult = () => {
        const result = new ActivityResult();
        result.data = 'test';
        return Promise.resolve(result);
      };
      cb(activityPort);
    });

    it('must delegate onRedirectError', () => {
      const activityPorts = new ActivityPorts(win);
      const redirectHandler = error => {
        setTimeout(() => {
          throw error;
        });
      };
      sandbox
        .stub(WebActivityPorts.prototype, 'onRedirectError')
        .callsFake(handler => {
          expect(handler).to.equal(redirectHandler);
        });
      activityPorts.onRedirectError(redirectHandler);
    });

    it('must delegate connect, disconnect and ready', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let connected = false;
      let ready = false;
      sandbox.stub(WebActivityIframePort.prototype, 'connect').callsFake(() => {
        connected = true;
        return Promise.resolve();
      });
      sandbox
        .stub(WebActivityIframePort.prototype, 'disconnect')
        .callsFake(() => {
          connected = false;
        });
      sandbox
        .stub(WebActivityIframePort.prototype, 'whenReady')
        .callsFake(() => {
          ready = true;
          return Promise.resolve();
        });
      return activityIframePort
        .connect()
        .then(() => {
          expect(connected).to.be.true;
          return activityIframePort.whenReady();
        })
        .then(() => {
          expect(ready).to.be.true;
          activityIframePort.disconnect();
          expect(connected).to.be.false;
        });
    });

    it('should delegate getMode and attach callback to connect', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      sandbox
        .stub(WebActivityIframePort.prototype, 'getMode')
        .callsFake(() => ActivityMode.IFRAME);
      expect(activityIframePort.getMode()).to.equal(ActivityMode.IFRAME);
      sandbox
        .stub(WebActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake(arg => {
          handler = arg;
        });
      return activityIframePort
        .connect()
        .then(() => {
          return handler;
        })
        .then(handler => {
          expect(handler).to.not.be.null;
        });
    });

    it('should handle resize request and delegate resized', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let resized = false;
      sandbox.stub(WebActivityIframePort.prototype, 'resized').callsFake(() => {
        resized = true;
      });
      activityIframePort.resized();
      expect(resized).to.be.true;
      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'onResizeRequest')
        .callsFake(arg => {
          handler = arg;
        });
      activityIframePort.onResizeRequest(num => {
        expect(num).to.equal(1);
      });
      expect(handler).to.not.be.null;
      handler(1);
    });

    it('should test delegated deprecated message apis', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let payload;
      sandbox
        .stub(WebActivityIframePort.prototype, 'message')
        .callsFake(args => {
          payload = args;
        });
      activityIframePort.messageDeprecated({'sku': 'daily'});
      expect(payload).to.deep.equal({'sku': 'daily'});
      let handler = null;
      activityIframePort.onMessageDeprecated(data => {
        expect(data).to.deep.equal({'sku': 'daily'});
      });
      sandbox
        .stub(WebActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake(arg => {
          handler = arg;
        });
      activityIframePort.onMessageDeprecated(data => {
        expect(data).to.deep.equal({'sku': 'daily'});
      });
      return activityIframePort
        .connect()
        .then(() => {
          return handler;
        })
        .then(handler => {
          expect(handler).to.not.be.null;
          handler({'sku': 'daily'});
        });
    });

    it('should allow registering callback after connect', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let payload;
      sandbox
        .stub(WebActivityIframePort.prototype, 'message')
        .callsFake(args => {
          payload = args;
        });
      activityIframePort.messageDeprecated({'sku': 'daily'});
      expect(payload).to.deep.equal({'sku': 'daily'});
      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake(arg => {
          handler = arg;
        });
      let callbackCalled = false;
      const callback = data => {
        callbackCalled = true;
        expect(data).to.deep.equal({'sku': 'daily'});
      };
      return activityIframePort
        .connect()
        .then(() => {
          return handler;
        })
        .then(handler => {
          expect(handler).to.not.be.null;
          handler({'sku': 'daily'});
          return Promise.resolve();
        })
        .then(() => {
          expect(callbackCalled).to.be.false;
          activityIframePort.onMessageDeprecated(callback);
          handler({'sku': 'daily'});
        });
    });

    it('should test new messaging APIs', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      const analyticsRequest = new AnalyticsRequest();
      analyticsRequest.setEvent(AnalyticsEvent['UNKNOWN']);
      const serializedRequest = analyticsRequest.toArray();
      let payload;
      sandbox
        .stub(WebActivityIframePort.prototype, 'message')
        .callsFake(args => {
          payload = args;
        });
      activityIframePort.execute(analyticsRequest);
      expect(payload).to.deep.equal({'REQUEST': serializedRequest});
      activityIframePort.on(AnalyticsRequest, request => {
        expect(request.getEvent()).to.equal(AnalyticsEvent['UNKNOWN']);
      });
      sandbox
        .stub(WebActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake(args => {
          handler = args;
        });
      return activityIframePort
        .connect()
        .then(() => {
          return handler;
        })
        .then(handler => {
          expect(handler).to.not.be.null;
          handler({'RESPONSE': serializedRequest});
        });
    });

    it('should support onMessageDeprecated AND on APIs', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      const analyticsRequest = new AnalyticsRequest();
      analyticsRequest.setEvent(AnalyticsEvent['UNKNOWN']);
      const serializedRequest = analyticsRequest.toArray();
      activityIframePort.on(AnalyticsRequest, request => {
        expect(request.getEvent()).to.equal(AnalyticsEvent['UNKNOWN']);
      });
      sandbox
        .stub(WebActivityIframePort.prototype, 'connect')
        .callsFake(() => Promise.resolve());
      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake(args => {
          handler = args;
        });
      activityIframePort.onMessageDeprecated(data => {
        expect(data['RESPONSE']).to.equal(serializedRequest);
      });
      return activityIframePort
        .connect()
        .then(() => {
          return handler;
        })
        .then(handler => {
          expect(handler).to.not.be.null;
          handler({'RESPONSE': serializedRequest});
        });
    });
  });
});
