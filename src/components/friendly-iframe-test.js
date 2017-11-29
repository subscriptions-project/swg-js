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

import {
  getStyle,
  getFriendlyIframeAttributes,
  getTopFriendlyIframeStyles,
  getTopFriendlyIframeImportantStyles,
} from '../utils/style';
import {FriendlyIframe} from './friendly-iframe';

describes.realWin('FriendlyIframe', {}, env => {
  let doc;
  let friendlyIframe;

  beforeEach(() => {
    doc = env.win.document;
    const attrs = Object.assign(
        {}, getFriendlyIframeAttributes(), {'class': 'swg-iframe'});
    friendlyIframe =
        new FriendlyIframe(doc, attrs, getTopFriendlyIframeStyles());
  });

  describe('friendlyIframe', () => {

    it('should have created a friendly iframe instance', function* () {
      expect(friendlyIframe.isConnected()).to.be.false;
      doc.body.appendChild(friendlyIframe.getElement());
      yield friendlyIframe.whenReady();

      const iframe = friendlyIframe.getElement();
      const iframeDocument = friendlyIframe.getDocument();
      const iframeBody = friendlyIframe.getBody();

      expect(iframe.getAttribute('src')).to.equal('about:blank');
      expect(iframeDocument.nodeType).to.equal(9 /* Document */);
      expect(iframeDocument.nodeName).to.equal('#document');
      expect(iframeBody.nodeType).to.equal(1 /* Element */);
      expect(iframeBody.parentElement.nodeName).to.equal('HTML');
      expect(iframeBody.nodeName).to.equal('BODY');
      expect(friendlyIframe.isConnected()).to.be.true;

      expect(iframe.getAttribute('style')).to.be.null;

      friendlyIframe
          .setIframeImportantStyles(getTopFriendlyIframeImportantStyles());
      friendlyIframe.setIframeStyles();

      expect(getStyle(iframe, 'opacity')).to.equal('1');
      expect(getStyle(iframe, 'position')).to.equal('fixed');
      expect(getStyle(iframe, 'bottom')).to.equal('0px');
    });
  });
});
