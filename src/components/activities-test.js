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

import {ActivityIframePort, ActivityPorts} from './activities';
import {
  ActivityMode,
  ActivityResult,
  ActivityIframePort as WebActivityIframePort,
  ActivityPort as WebActivityPort,
  ActivityPorts as WebActivityPorts,
} from 'web-activities/activity-ports';
import {AnalyticsEvent, AnalyticsRequest} from '../proto/api_messages';
import {AnalyticsService} from '../runtime/analytics-service';
import {ClientEventManager} from '../runtime/client-event-manager';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import {PageConfig} from '../model/page-config';
import {tick} from '../../test/tick';

const publicationId = 'PUB_ID';

describes.realWin('Activity Components', {}, (env) => {
  let win, iframe, url, dialog, doc, deps, pageConfig, analytics, activityPorts;
  let eventManager;

  beforeEach(() => {
    url = '/hello';
    win = env.win;
    doc = new GlobalDoc(win);
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    iframe = dialog.getElement();
    doc.getBody().appendChild(iframe);
    eventManager = new ClientEventManager(Promise.resolve());

    pageConfig = new PageConfig(publicationId, false);
    deps = {
      win: () => win,
      pageConfig: () => pageConfig,
      doc: () => doc,
      eventManager: () => eventManager,
    };
    activityPorts = new ActivityPorts(deps);
    deps['activities'] = () => activityPorts;
    analytics = new AnalyticsService(deps);
    deps['analytics'] = () => analytics;
  });

  afterEach(() => {});

  describe('ActivityPorts', () => {
    describe('default arguments', () => {
      let expectedDefaults;

      beforeEach(() => {
        expectedDefaults = {
          'analyticsContext': analytics.getContext().toArray(),
          'publicationId': pageConfig.getPublicationId(),
          'productId': pageConfig.getProductId(),
          '_client': 'SwG $internalRuntimeVersion$',
          'supportsEventManager': true,
        };
      });

      it('should accept no arguments', () => {
        expect(activityPorts.addDefaultArguments()).to.deep.equal(
          expectedDefaults
        );
      });

      it('should fill in an empty object', () => {
        expect(activityPorts.addDefaultArguments({})).to.deep.equal(
          expectedDefaults
        );
      });

      it('should add to an existing object', () => {
        const newArgs = {
          aVal: 1,
        };
        const expectedObject = Object.assign({}, expectedDefaults, newArgs);

        expect(activityPorts.addDefaultArguments(newArgs)).to.deep.equal(
          expectedObject
        );
      });

      it('should not override passed values', () => {
        const newArgs = {
          productId: 55555555,
        };
        const expectedObject = Object.assign({}, expectedDefaults, newArgs);

        expect(activityPorts.addDefaultArguments(newArgs)).to.deep.equal(
          expectedObject
        );
      });

      it('should not add them to open', () => {
        let passedArgs = null;
        sandbox
          .stub(activityPorts.activityPorts_, 'open')
          .callsFake((_requestId, _url, _target, args) => {
            passedArgs = args;
          });
        activityPorts.open('', '', '');

        expect(passedArgs).to.be.undefined;
      });

      it('should add them to open', () => {
        let passedArgs;
        sandbox
          .stub(activityPorts.activityPorts_, 'open')
          .callsFake((_requestId, _url, _target, args) => {
            passedArgs = args;
          });
        activityPorts.open('', '', '', null, {}, true);

        expect(passedArgs).to.deep.equal(expectedDefaults);
      });

      it('should not add them to openIframe', () => {
        // The best test I could come up with was just to ensure it passed the
        // arguments to addDefaultArguments and used the result.
        let receivedArgs = null;
        const sentArgs = {
          a: 1,
        };
        sandbox
          .stub(activityPorts, 'openActivityIframePort_')
          .callsFake((_iframe, _url, args) => {
            receivedArgs = args;
            return args;
          });

        activityPorts.openIframe(iframe, url, sentArgs);

        expect(receivedArgs).to.deep.equal(sentArgs);
      });

      it('should add them to openIframe', () => {
        // The best test I could come up with was just to ensure it passed the
        // arguments to addDefaultArguments and used the result.
        let receivedArgs;
        const sentArgs = {
          a: 1,
        };
        sandbox
          .stub(activityPorts, 'openActivityIframePort_')
          .callsFake((_iframe, _url, args) => {
            receivedArgs = args;
            return args;
          });
        activityPorts.openIframe(iframe, url, sentArgs, true);

        expect(receivedArgs).to.deep.equal(
          activityPorts.addDefaultArguments(sentArgs)
        );
      });
    });

    describe('function delegation', () => {
      it('should delegate openIframe to ActivityIframePort', async () => {
        sandbox
          .stub(ActivityIframePort.prototype, 'connect')
          .callsFake(() => Promise.resolve());
        const port = await activityPorts.openIframe(iframe, url);

        expect(port instanceof ActivityIframePort).to.be.true;
      });

      it('should delegate open', () => {
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

      it('must delegate onResult', async () => {
        let result;
        const resultHandler = async (portDef) => {
          result = await portDef.acceptResult();
        };
        let cb;
        let requestId;
        sandbox
          .stub(WebActivityPorts.prototype, 'onResult')
          .callsFake((reqId, handler) => {
            requestId = reqId;
            cb = handler;
          });
        activityPorts.onResult('result', resultHandler);
        const activityPort = new WebActivityPort();
        activityPort.acceptResult = () => {
          const result = new ActivityResult();
          result.data = 'test';
          return Promise.resolve(result);
        };
        await cb(activityPort);

        expect(requestId).to.equal('result');
        expect(result.data).to.equal('test');
      });

      it('must delegate onRedirectError', () => {
        let actualHandler;
        sandbox
          .stub(WebActivityPorts.prototype, 'onRedirectError')
          .callsFake((handler) => {
            actualHandler = handler;
          });

        const expectedHandler = sandbox.mock();
        activityPorts.onRedirectError(expectedHandler);

        expect(actualHandler).to.equal(expectedHandler);
      });

      it('makes original activity ports available', () => {
        const original = activityPorts.getOriginalWebActivityPorts();
        expect(original).to.be.instanceof(WebActivityPorts);
      });
    });
  });

  describe('ActivityIframePort', () => {
    let activityIframePort;
    let connected;
    let handler;
    let analyticsRequest;
    let serializedRequest;

    beforeEach(() => {
      handler = null;
      connected = false;
      sandbox.stub(WebActivityIframePort.prototype, 'connect').callsFake(() => {
        connected = true;
        return Promise.resolve();
      });
      sandbox
        .stub(WebActivityIframePort.prototype, 'onMessage')
        .callsFake((args) => {
          handler = args;
        });

      analyticsRequest = new AnalyticsRequest();
      analyticsRequest.setEvent(AnalyticsEvent.UNKNOWN);
      serializedRequest = analyticsRequest.toArray();
      activityIframePort = new ActivityIframePort(iframe, url, deps);
    });

    it('must delegate connect, disconnect and ready', async () => {
      let ready = false;
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
      await activityIframePort.connect();
      expect(connected).to.be.true;

      await activityIframePort.whenReady();
      expect(ready).to.be.true;

      activityIframePort.disconnect();
      expect(connected).to.be.false;
    });

    it('should delegate getMode and attach callback to connect', async () => {
      sandbox
        .stub(WebActivityIframePort.prototype, 'getMode')
        .returns(ActivityMode.IFRAME);
      expect(activityIframePort.getMode()).to.equal(ActivityMode.IFRAME);

      expect(handler).to.be.null;
      await activityIframePort.connect();
      expect(handler).to.not.be.null;
    });

    it('delegates acceptResult', async () => {
      const value = 'Hi!';
      sandbox.stub(WebActivityIframePort.prototype, 'getMode').returns(value);
      expect(activityIframePort.getMode()).to.equal(value);
    });

    it('should handle resize request and delegate resized', () => {
      let resized = false;
      sandbox.stub(WebActivityIframePort.prototype, 'resized').callsFake(() => {
        resized = true;
      });
      activityIframePort.resized();
      expect(resized).to.be.true;

      let handler = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'onResizeRequest')
        .callsFake((arg) => {
          handler = arg;
        });
      let num;

      expect(handler).to.be.null;
      activityIframePort.onResizeRequest((n) => {
        num = n;
      });
      expect(handler).to.not.be.null;

      handler(1);
      expect(num).to.equal(1);
    });

    it('should allow registering callback after connect', async () => {
      expect(handler).to.be.null;
      await activityIframePort.connect();
      expect(handler).to.not.be.null;

      handler({'sku': 'daily'});
      await tick();
      handler({'sku': 'daily'});
    });

    it('should test new messaging APIs and auto register logging', async () => {
      let payload;
      let event = null;
      sandbox
        .stub(WebActivityIframePort.prototype, 'message')
        .callsFake((args) => {
          payload = args;
        });
      sandbox.stub(deps.eventManager(), 'logEvent').callsFake((clientEvent) => {
        event = clientEvent.eventType;
      });
      activityIframePort.execute(analyticsRequest);
      expect(payload).to.deep.equal({'REQUEST': serializedRequest});

      expect(handler).to.be.null;
      await activityIframePort.connect();
      expect(handler).to.not.be.null;

      handler({'RESPONSE': serializedRequest});
      expect(event).to.equal(AnalyticsEvent.UNKNOWN);
    });

    it('should support on APIs and register logging', async () => {
      expect(handler).to.be.null;
      await activityIframePort.connect();
      expect(handler).to.not.be.null;

      let event;
      sandbox.stub(deps.eventManager(), 'logEvent').callsFake((clientEvent) => {
        event = clientEvent.eventType;
      });
      handler({'RESPONSE': serializedRequest});
      expect(event).to.equal(AnalyticsEvent.UNKNOWN);
    });

    it('should complain about multiple listeners', async () => {
      await activityIframePort.connect();
      expect(() => activityIframePort.on(AnalyticsRequest, () => {})).to.throw(
        /Invalid type or duplicate callback for /
      );
    });

    it('should complain about bad request types', async () => {
      class fakeMe {}
      expect(() => activityIframePort.on(fakeMe, () => {})).to.throw(
        /Invalid data type/
      );
    });
  });
});
