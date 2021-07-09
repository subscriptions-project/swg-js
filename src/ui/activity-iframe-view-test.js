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

import {ActivityIframePort, ActivityPorts} from '../components/activities';
import {ActivityIframeView} from './activity-iframe-view';
import {ActivityResult} from 'web-activities/activity-ports';
import {Dialog} from '../components/dialog';
import {ExperimentFlags} from '../runtime/experiment-flags';
import {GlobalDoc} from '../model/doc';
import {SkuSelectedResponse} from '../proto/api_messages';
import {
  setExperiment,
  setExperimentsStringForTesting,
} from '../runtime/experiments';

describes.realWin('ActivityIframeView', {}, (env) => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let activityIframeView;
  let dialog;
  let deps;

  const activityArgs = {
    'publicationId': 'pub1',
    'requestId': 'request1-complete',
    'returnUrl': 'https://pub.com/complete',
  };

  beforeEach(() => {
    win = env.win;
    src = '$frontend$/offersiframe';
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    deps = {
      win: () => win,
    };
    activityPorts = new ActivityPorts(deps);
    activityIframePort = new ActivityIframePort(
      dialog.getElement(),
      src,
      activityPorts
    );

    sandbox
      .stub(activityIframePort, 'whenReady')
      .callsFake(() => Promise.resolve(true));

    sandbox
      .stub(activityPorts, 'openIframe')
      .callsFake(() => Promise.resolve(activityIframePort));

    sandbox.stub(activityIframePort, 'onResizeRequest').callsFake(() => true);

    activityIframeView = new ActivityIframeView(
      win,
      activityPorts,
      src,
      activityArgs
    );
  });

  afterEach(() => {
    setExperimentsStringForTesting('');
  });

  describe('ActivityIframeView', () => {
    it('should have activityIframeView constructed', () => {
      const activityIframe = activityIframeView.getElement();
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(activityIframe.getAttribute('frameborder')).to.equal('0');
    });

    it('should initialize and open an iframe', async () => {
      const openedDialog = await dialog.open();

      // The iframe should be inside DOM to call init().
      dialog.getContainer().appendChild(activityIframeView.getElement());

      const activityResponse = await activityIframeView.init(openedDialog);
      expect(activityResponse).to.be.true;
      expect(activityPorts.openIframe).to.have.been.calledOnce;

      const firstArgument = activityPorts.openIframe.getCall(0).args[0];
      expect(firstArgument.nodeName).to.equal('IFRAME');
      const secondArgument = activityPorts.openIframe.getCall(0).args[1];
      expect(secondArgument).to.equal(src);
      const thirdArgument = activityPorts.openIframe.getCall(0).args[2];
      expect(thirdArgument).to.equal(activityArgs);

      expect(activityIframePort.onResizeRequest).to.have.been.calledOnce;
      expect(activityIframePort.whenReady).to.have.been.calledOnce;
    });

    it.only('should disallow scrolling within dialogs', async () => {
      const iframe = new ActivityIframeView(
        win,
        activityPorts,
        src,
        activityArgs
      ).getElement();

      expect(iframe.scrolling).to.equal('no');
    });

    it.only('should (optionally) allow scrolling within dialogs', async () => {
      setExperiment(win, ExperimentFlags.SCROLLING_WITHIN_DIALOGS, true);

      const iframe = new ActivityIframeView(
        win,
        activityPorts,
        src,
        activityArgs
      ).getElement();

      expect(iframe.scrolling).to.equal('');
    });

    it('should accept port and result', async () => {
      const result = new ActivityResult('OK');
      sandbox
        .stub(activityIframePort, 'acceptResult')
        .callsFake(() => Promise.resolve(result));

      await activityIframeView.init(dialog);
      expect(activityIframePort.whenReady).to.have.been.calledOnce;

      const actualPort = await activityIframeView.getPortPromise_();
      const actualResult = await activityIframeView.acceptResult();
      expect(actualPort).to.equal(activityIframePort);
      expect(actualResult).to.equal(result);
    });

    it('should accept port and result and verify', async () => {
      const ORIGIN = 'https://example.com';
      const VERIFIED = true;
      const SECURE = true;
      const result = new ActivityResult(
        'OK',
        'A',
        'MODE',
        ORIGIN,
        VERIFIED,
        SECURE
      );
      sandbox
        .stub(activityIframePort, 'acceptResult')
        .callsFake(() => Promise.resolve(result));
      await activityIframeView.init(dialog);
      expect(activityIframePort.whenReady).to.have.been.calledOnce;

      const actualPort = await activityIframeView.getPortPromise_();
      const actualResult = await activityIframeView.acceptResultAndVerify(
        ORIGIN,
        VERIFIED,
        SECURE
      );
      expect(actualPort).to.equal(activityIframePort);
      expect(actualResult).to.equal(result.data);
    });

    it('should send and receive messages', async () => {
      let onCb;
      let messageLabel;
      let messageFromExecuteFake;
      let messageFromOnCallback;

      const message = new SkuSelectedResponse();
      message.setSku('sku1');

      sandbox.stub(activityIframePort, 'on').callsFake((Message, cb) => {
        messageLabel = Message.prototype.label();
        onCb = cb;
      });
      activityIframeView.on(SkuSelectedResponse, (message) => {
        messageFromOnCallback = message;
      });

      sandbox.stub(activityIframePort, 'execute').callsFake((message) => {
        messageFromExecuteFake = message;
      });
      activityIframeView.execute(message);

      await activityIframeView.init(dialog);
      await activityIframeView.getPortPromise_();
      onCb(message);
      expect(message).to.equal(messageFromExecuteFake);
      expect(message).to.equal(messageFromOnCallback);
      expect(messageLabel).to.equal('SkuSelectedResponse');
    });

    it('should await cancel callback', async () => {
      sandbox
        .stub(activityIframePort, 'acceptResult')
        .callsFake(() =>
          Promise.reject(new DOMException('cancel', 'AbortError'))
        );
      const cancelPromise = new Promise((resolve) => {
        activityIframeView.onCancel(resolve);
      });
      activityIframeView.init(dialog);
      await cancelPromise;
    });

    it('should cache loading indicator', async () => {
      expect(activityIframeView.hasLoadingIndicator()).to.be.false;
      const activityIframeView2 = new ActivityIframeView(
        win,
        activityPorts,
        src,
        activityArgs,
        false,
        true
      );
      expect(activityIframeView2.hasLoadingIndicator()).to.be.true;
    });
  });
});
