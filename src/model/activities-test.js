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
  ActivityResult,
  ActivityResultCode,
  ActivityMode,
} from 'web-activities/activity-ports';
import {
  ActivityPorts,
  ActivityIframePort,
} from './activities';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import * as sinon from 'sinon';
import {AnalyticsRequest, AnalyticsEvent} from '../proto/api_messages';

describes.realWin('ActivityPorts test', {}, env => {
  let win, iframe, activitiesMock, iframePortMock, url, dialog;
  let webActivityPorts, webActivityIframePort;

  beforeEach(() => {
    win = env.win;
    url = '/hello';
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    iframe = dialog.getElement();
    webActivityPorts = new WebActivityPorts(win);
    activitiesMock = sandbox.mock(webActivityPorts);
    webActivityIframePort = new WebActivityIframePort(iframe, url);
    iframePortMock = sandbox.mock(webActivityIframePort);
  });

  afterEach(() => {
    activitiesMock.verify();
    iframePortMock.verify();
  });

  describe('test delegation', () => {
    it('should delegate openIframe', () => {
      const activityPorts = new ActivityPorts(webActivityPorts);
      let opt_args;
      activitiesMock.expects('openIframe').withExactArgs(
          sinon.match(arg => arg.tagName == 'IFRAME'),
          '/hello',
          opt_args
        ).returns(
          Promise.resolve(webActivityIframePort));
      return activityPorts.openIframe(iframe, url).then(port => {
        expect(port.iframePort_).to.equal(webActivityIframePort);
      });
    });

    it('should delegate open', () => {
      const activityPorts = new ActivityPorts(webActivityPorts);
      activitiesMock.expects('open').returns({targetWin: null});
      const opener = activityPorts.open('some_request_id', '/someUrl',
          '_top', {});
      expect(opener.targetWin).to.be.null;
    });

    it('must delegate onResult', () => {
      const activityPorts = new ActivityPorts(webActivityPorts);
      let handler = null;
      activitiesMock.expects('onResult')
          .withExactArgs('result', sinon.match(arg => {
            handler = arg;
            return typeof arg == 'function';
          })).once();
      activityPorts.onResult('result', activityResult => {
        expect(activityResult.code).to.equal(ActivityResultCode.OK);
      });
      handler(new ActivityResult(ActivityResultCode.OK, {},
            ActivityMode.IFRAME, '/hello', true, true));
    });

    it('must delegate onRedirectError', () => {
      const activityPorts = new ActivityPorts(webActivityPorts);
      let handler = null;
      activitiesMock.expects('onRedirectError')
          .withExactArgs(sinon.match(arg => {
            handler = arg;
            return typeof arg == 'function';
          })).once();
      activityPorts.onRedirectError(error => {
        expect(error.message).to.equal('I am an error message');
      });
      handler(new Error('I am an error message'));
    });

    it('must delegate connect and disconnect', () => {
      const activityIframePort = new ActivityIframePort(webActivityIframePort);
      iframePortMock.expects('connect').returns(Promise.resolve());
      const connectPromise = activityIframePort.connect();
      iframePortMock.expects('disconnect');
      activityIframePort.disconnect();
      return connectPromise;
    });

    it('should delegate getMode and attach callback to whenReady', () => {
      const activityIframePort = new ActivityIframePort(webActivityIframePort);
      iframePortMock.expects('getMode').returns(ActivityMode.IFRAME);
      expect(activityIframePort.getMode()).to.equal(ActivityMode.IFRAME);
      iframePortMock.expects('whenReady').returns(Promise.resolve());
      let handler = null;
      iframePortMock.expects('onMessage').withExactArgs(sinon.match(arg => {
        handler = arg;
        return typeof arg == 'function';
      })).once();
      return activityIframePort.whenReady().then(() => {
        return handler;
      }).then(handler => {
        expect(handler).to.not.be.null;
      });
    });

    it('should handle resize request and delegate resized', () => {
      const activityIframePort = new ActivityIframePort(webActivityIframePort);
      iframePortMock.expects('resized');
      activityIframePort.resized();
      let handler = null;
      iframePortMock.expects('onResizeRequest').withExactArgs(
          sinon.match(arg => {
            handler = arg;
            return typeof arg == 'function';
          })).once();
      activityIframePort.onResizeRequest(num => {
        expect(num).to.equal(1);
      });
      expect(handler).to.not.be.null;
      handler(1);
    });

    it('should test delegated deprecated message apis', () => {
      const activityIframePort = new ActivityIframePort(webActivityIframePort);
      iframePortMock.expects('message').withExactArgs(
        {'sku': 'daily'}
      ).once();
      activityIframePort.messageDeprecated({'sku': 'daily'});
      let handler = null;
      iframePortMock.expects('onMessage').withExactArgs(
          sinon.match(arg => {
            handler = arg;
            return typeof arg == 'function';
          })).once();
      activityIframePort.onMessageDeprecated(data => {
        expect(data).to.deep.equal({'sku': 'daily'});
      });
      expect(handler).to.not.be.null;
      handler({'sku': 'daily'});
    });

    it('should test new messaging APIs', () => {
      const activityIframePort = new ActivityIframePort(webActivityIframePort);
      const analyticsRequest = new AnalyticsRequest();
      analyticsRequest.setEvent(AnalyticsEvent.UNKNOWN);
      const serializedRequest = analyticsRequest.toArray();
      iframePortMock.expects('message').withExactArgs(
        {'REQUEST': serializedRequest}
      ).once();
      activityIframePort.execute(analyticsRequest);
      activityIframePort.on(AnalyticsRequest, request => {
        expect(request.getEvent()).to.equal(AnalyticsEvent.UNKNOWN);
      });
      iframePortMock.expects('whenReady').returns(Promise.resolve());
      let handler = null;
      iframePortMock.expects('onMessage').withExactArgs(sinon.match(arg => {
        handler = arg;
        return typeof arg == 'function';
      })).once();
      return activityIframePort.whenReady().then(() => {
        return handler;
      }).then(handler => {
        expect(handler).to.not.be.null;
        handler({'RESPONSE': serializedRequest});
      });
    });
  });
});

