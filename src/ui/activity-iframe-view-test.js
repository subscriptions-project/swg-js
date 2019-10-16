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

import {ActivityIframeView} from './activity-iframe-view';
import {ActivityResult} from 'web-activities/activity-ports';
import {ActivityPorts, ActivityIframePort} from '../components/activities';
import {Dialog} from '../components/dialog';
import {GlobalDoc} from '../model/doc';
import {SkuSelectedResponse} from '../proto/api_messages';

describes.realWin('ActivityIframeView', {}, env => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let activityIframeView;
  let dialog;

  const activityArgs = {
    'publicationId': 'pub1',
    'requestId': 'request1-complete',
    'returnUrl': 'https://pub.com/complete',
  };

  beforeEach(() => {
    win = env.win;
    src = '$frontend$/offersiframe';
    dialog = new Dialog(new GlobalDoc(win), {height: '100px'});
    activityPorts = new ActivityPorts(win);
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
      let messageCallback;
      let onCb;
      let messageLabel;
      let payload;
      let dataSent;

      sandbox.stub(activityIframePort, 'execute').callsFake(data => {
        dataSent = data;
      });

      sandbox.stub(activityIframePort, 'on').callsFake((messageCtor, cb) => {
        messageLabel = new messageCtor().label();
        onCb = cb;
      });
      const skuSelection = new SkuSelectedResponse();
      skuSelection.setSku('sku1');
      activityIframeView.on(SkuSelectedResponse, skuSelected => {
        expect(skuSelected.getSku()).to.equal('sku1');
        expect(messageLabel).to.equal('SkuSelectedResponse');
      });
      activityIframeView.execute(skuSelection);
      await activityIframeView.init(dialog);
      await activityIframeView.getPortPromise_();
      messageCallback({'test': true});
      onCb(skuSelection);
      expect(payload).to.deep.equal({'test': true});
      expect(dataSent.label()).to.equal('SkuSelectedResponse');
      expect(dataSent.getSku()).to.equal('sku1');
    });

    it('should await cancel callback', async () => {
      sandbox
        .stub(activityIframePort, 'acceptResult')
        .callsFake(() =>
          Promise.reject(new DOMException('cancel', 'AbortError'))
        );
      const cancelPromise = new Promise(resolve => {
        activityIframeView.onCancel(resolve);
      });
      activityIframeView.init(dialog);
      return cancelPromise;
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
