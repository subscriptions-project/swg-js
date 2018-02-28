/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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
import {ActivityPorts, ActivityIframePort} from 'web-activities/activity-ports';
import {Dialog} from '../components/dialog';

describes.realWin('ActivityIframeView', {}, env => {
  let win;
  let src;
  let activityPorts;
  let activityIframePort;
  let activityIframeView;
  let dialog;
  const activityArgs = {
    'publisherId': 'pub1',
    'requestId': 'request1-complete',
    'returnUrl': 'https://pub.com/complete',
  };

  beforeEach(() => {
    win = env.win;
    src = '$frontend$/offersiframe';
    dialog = new Dialog(win, {height: '100px'});
    activityPorts = new ActivityPorts(win);
    activityIframePort =
        new ActivityIframePort(dialog.getElement(), src, activityPorts);

    sandbox.stub(
        activityIframePort,
        'whenReady',
        () => Promise.resolve(true));

    sandbox.stub(
        activityIframePort,
        'onMessage',
        () => {
          return Promise.resolve(true);
          return function() {
            return {'sku': 'basic'};
          };
        });

    sandbox.stub(
        activityPorts,
        'openIframe',
        () => Promise.resolve(activityIframePort));

    sandbox.stub(
        activityIframePort,
        'onResizeRequest',
        () => true);

    activityIframeView =
        new ActivityIframeView(win, activityPorts, src, activityArgs);
  });

  describe('ActivityIframeView', () => {
    it('should have activityIframeView constructed', () => {
      const activityIframe = activityIframeView.getElement();
      expect(activityIframe.nodeType).to.equal(1);
      expect(activityIframe.nodeName).to.equal('IFRAME');
      expect(activityIframe.getAttribute('frameborder')).to.equal('0');
    });

    it('should should initialize and open an iframe', function* () {
      const openedDialog = yield dialog.open();

      // The iframe should be inside DOM to call init().
      dialog.getContainer().appendChild(activityIframeView.getElement());

      const activityResponse = yield activityIframeView.init(openedDialog);
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
  });
});
