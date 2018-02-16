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

import {Toast} from './toast';
import {
  getStyle,
  googleFontsUrl,
} from '../utils/style';

describes.realWin('Toast', {}, env => {
  let win;
  let spec;
  let toast;

  beforeEach(() => {
    win = env.win;
    spec = {
      text: 'Access via Google Subscriptions',
      action: {
        label: 'Details',
        handler: function() {
          return true;
        },
      },
    };
    toast = new Toast(win, spec);
  });

  // TODO(dparikh): too flaky with fetch. Cool idea. Maybe setup in integration
  // tests somehow? But it also depends if we are going to have any fonts
  // left here?
  it.skip('should have valid https Url and fetch the fonts', function* () {
    const response = yield fetch(googleFontsUrl);
    expect(/^https:/.test(googleFontsUrl)).to.be.true;
    expect(response.ok).to.be.true;
    expect(response.status).to.equal(200);
  });

  it('should have created Notification View', function* () {
    const iframe = toast.getElement();
    expect(iframe.nodeType).to.equal(1);
    expect(iframe.nodeName).to.equal('IFRAME');

    expect(getStyle(iframe, 'opacity')).to.equal('1');
    expect(getStyle(iframe, 'font-family'))
        .to.equal('"Google sans", sans-serif');
    expect(getStyle(iframe, 'bottom')).to.equal('0px');
    expect(getStyle(iframe, 'display')).to.equal('block');

    // These two properties are not set !important.
    expect(getStyle(iframe, 'width')).to.equal('100%');
    expect(getStyle(iframe, 'left')).to.equal('0px');
  });

  it('should build the content of toast iframe', function* () {
    yield toast.open();
    const toastContainer = toast.getIframe().getBody()
        .querySelector('div[class="swg-toast-container"]');
    expect(toastContainer.getAttribute('class'))
        .to.equal('swg-toast-container');

    expect(win.getComputedStyle(toastContainer).getPropertyValue('display'))
        .to.equal('flex');

    // Should have 'text' and 'action' items.
    expect(toastContainer.children.length).to.equal(2);

    const label = toastContainer.children[0];
    expect(label.getAttribute('class')).to.equal('swg-label');
    expect(label.textContent).to.equal(spec.text);

    const detail = toastContainer.children[1];
    expect(win.getComputedStyle(detail).getPropertyValue('color'))
        .to.equal('rgb(0, 255, 0)');
    expect(detail.getAttribute('class')).to.equal('swg-detail');
    expect(detail.getAttribute('aria-label')).to.equal(spec.action.label);
    expect(detail.textContent).to.equal(spec.action.label);
  });
});
