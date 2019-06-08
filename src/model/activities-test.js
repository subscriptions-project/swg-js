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
  ActivityMode,
  ActivityResult,
  ActivityResultCode,
} from 'web-activities/activity-ports';
import {
  ActivityPorts,
  ActivityIframePort,
  ActivityPort,
} from './activities';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import {AnalyticsRequest, AnalyticsEvent} from '../proto/api_messages';

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

  afterEach(() => {
  });

  describe('test delegation', () => {
    it('should delegate openIframe to ActivityIframePort', () => {
      const activityPorts = new ActivityPorts(win);
      sandbox.stub(ActivityIframePort.prototype,
          'connect', () => Promise.resolve());
      return activityPorts.openIframe(iframe, url).then(port => {
        expect(port instanceof ActivityIframePort).to.be.true;
      });
    });

    it('should delegate open', () => {
      const activityPorts = new ActivityPorts(win);
      sandbox.stub(/*OK*/WebActivityPorts.prototype, 'open', () => {
        return {targetWin: null};
      });
      const opener = activityPorts.open('some_request_id', '/someUrl',
          '_top', {});
      expect(opener.targetWin).to.be.null;
    });

    it('must delegate onResult', done => {
      const activityPorts = new ActivityPorts(win);
      const resultHandler = resultPromise => {
        resultPromise.then(result => {
          expect(result).to.deep.equal({'testing': true});
          done();
        });
      };
      const activityPort = new ActivityPort();
      activityPort.acceptResult = () => {
        const activityResult = new ActivityResult();
        activityResult.code = ActivityResultCode.OK;
        activityResult.origin = '/hello';
        activityResult.originVerified = true;
        activityResult.secureChannel = true;
        activityResult.data = {'testing': true};
        return Promise.resolve(activityResult);
      };
      let callback;
      sandbox.stub(WebActivityPorts.prototype, 'onResult',
          (requestId, handler) => {
            expect(requestId).to.equal('result');
            callback = handler;
            expect(handler).to.not.be.null;
          });
      const verifier = result => {
        expect(result.origin).to.equal('/hello');
        expect(result.originVerified).to.be.true;
        expect(result.secureChannel).to.be.true;
        return true;
      };
      activityPorts.onResult('result', verifier, resultHandler);
      callback(activityPort);
    });

    it('must throw result verification error', done => {
      const activityPorts = new ActivityPorts(win);
      const resultHandler = resultPromise => {
        resultPromise.then(() => {
          throw new Error('must have failed');
        }).catch(error => {
          expect(() => {throw error;}).to.throw(/channel mismatch/);
          done();
        });
      };
      const activityPort = new ActivityPort();
      activityPort.acceptResult = () => {
        const activityResult = new ActivityResult();
        return Promise.resolve(activityResult);
      };
      let callback;
      sandbox.stub(WebActivityPorts.prototype, 'onResult',
          (requestId, handler) => {
            expect(requestId).to.equal('result');
            callback = handler;
            expect(handler).to.not.be.null;
          });
      const verifier = () => {
        throw new Error('channel mismatch');
      };
      activityPorts.onResult('result', verifier, resultHandler);
      callback(activityPort);
    });

    it('must delegate onRedirectError', () => {
      const activityPorts = new ActivityPorts(win);
      const redirectHandler = error => {
        setTimeout(() => {
          throw error;
        });
      };
      sandbox.stub(WebActivityPorts.prototype, 'onRedirectError',
          handler => {
            expect(handler).to.equal(redirectHandler);
          });
      activityPorts.onRedirectError(redirectHandler);
    });

    it('must delegate connect and disconnect', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let connected = false;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'connect', () => {
        connected = true;
        return Promise.resolve();
      });
      return activityIframePort.connect().then(() => {
        expect(connected).to.be.true;
      });
    });

    it('should delegate getMode and attach callback to whenReady', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'getMode',
          () => ActivityMode.IFRAME);
      expect(activityIframePort.getMode()).to.equal(ActivityMode.IFRAME);
      sandbox.stub(/*OK*/WebActivityIframePort.prototype,
          'whenReady', () => Promise.resolve());
      let handler = null;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'onMessage', arg => {
        handler = arg;
      });
      return activityIframePort.whenReady().then(() => {
        return handler;
      }).then(handler => {
        expect(handler).to.not.be.null;
      });
    });

    it('should handle resize request and delegate resized', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      let resized = false;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'resized', () => {
        resized = true;
      });
      activityIframePort.resized();
      expect(resized).to.be.true;
      let handler = null;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'onResizeRequest',
          arg => {
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
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'message',
          args => {
            payload = args;
          });
      activityIframePort.messageDeprecated({'sku': 'daily'});
      expect(payload).to.deep.equal({'sku': 'daily'});
      let handler = null;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'onMessage',
          arg => {
            handler = arg;
          });
      activityIframePort.onMessageDeprecated(data => {
        expect(data).to.deep.equal({'sku': 'daily'});
      });
      expect(handler).to.not.be.null;
      handler({'sku': 'daily'});
    });

    it('should test new messaging APIs', () => {
      const activityIframePort = new ActivityIframePort(iframe, url);
      const analyticsRequest = new AnalyticsRequest();
      analyticsRequest.setEvent(AnalyticsEvent.UNKNOWN);
      const serializedRequest = analyticsRequest.toArray();
      let payload;
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'message', args => {
        payload = args;
      });
      activityIframePort.execute(analyticsRequest);
      expect(payload).to.deep.equal({'REQUEST': serializedRequest});
      activityIframePort.on(AnalyticsRequest, request => {
        expect(request.getEvent()).to.equal(AnalyticsEvent.UNKNOWN);
      });
      sandbox.stub(/*OK*/WebActivityIframePort.prototype, 'whenReady',
          () => Promise.resolve());
      let handler = null;
      sandbox.stub(WebActivityIframePort./*OK*/prototype, 'onMessage', args => {
        handler = args;
      });
      return activityIframePort.whenReady().then(() => {
        return handler;
      }).then(handler => {
        expect(handler).to.not.be.null;
        handler({'RESPONSE': serializedRequest});
      });
    });
  });
});

