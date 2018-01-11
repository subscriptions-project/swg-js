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

import {ActivityIframeView} from './activity-iframe-view';
import {Dialog} from '../components/dialog';

describes.realWin('ActivityIframeView', {}, env => {
  let win;
  let src;
  let mockActivityPorts;
  let port;
  let activityIframeView;
  let dialog;

  beforeEach(() => {
    win = env.win;
    src = 'http://subscribe.sandbox.google.com/subscribewithgoogleclientui/offersiframe';
    dialog = new Dialog(win, {height: '100px'});

    port = {
      onResizeRequest: function() {
        return Promise.resolve(true);
      },
      whenReady: function() {
        return Promise.resolve(true);
      },
    };
    mockActivityPorts = {
      openIframe: function() {
        return Promise.resolve(port);
      },
    };

    activityIframeView =
        new ActivityIframeView(win, mockActivityPorts, src, {});
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
    });
  });
});
