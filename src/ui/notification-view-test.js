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

import {getStyle} from '../utils/style';

import {
  NotificationView,
  GOOGLE_FONTS_URL,
  IFRAME_ATTRIBUTES,
  IFRAME_STYLES,
  NOTIFICATION_DETAIL_ARIA_LABEL,
  NOTIFICATION_DETAIL_CLASS,
  NOTIFICATION_DETAIL_LABEL,
  NOTIFICATION_LABEL,
  NOTIFICATION_LABEL_CLASS,
} from './notification-view';


describes.realWin('NotificationView', {}, env => {
  let win;
  let state;
  let notificationView;

  beforeEach(() => {
    win = env.win;
    state = {
      showRetry: false,
      activeResponse: {
        'entitled': true,
        'subscriber': {
          'entitlementId': 'f604b2e2-7c73',
          'healthy': true,
          'source': 'subscriptions.google.com',
          'types': ['allowed'],
          'url': 'https://play-next-staging.corp.google.com/store/account',
        },
      },
    };
    notificationView = new NotificationView(win, state);
  });

  it('should have valid https Url and fetch the fonts', function* () {
    const response = yield fetch(GOOGLE_FONTS_URL);
    expect(/^https:/.test(GOOGLE_FONTS_URL)).to.be.true;
    expect(response.ok).to.be.true;
    expect(response.status).to.equal(200);
  });

  it('should have created Notification View', function* () {
    yield notificationView.start();
    const iframe = notificationView.notificationContainer;

    expect(notificationView).to.be.defined;
    expect(iframe).to.be.defined;
    expect(iframe.srcdoc).to.equal('<h1>Fake iframe</h1>');
    expect(iframe.getAttribute('frameborder'))
        .to.equal(IFRAME_ATTRIBUTES.frameborder.toString());
    expect(iframe.getAttribute('scrolling'))
        .to.equal(IFRAME_ATTRIBUTES.scrolling);
    expect(iframe.getAttribute('src'))
        .to.equal(IFRAME_ATTRIBUTES.src);

    for (const key in IFRAME_STYLES) {
      const styleValue = getStyle(iframe, key);
      expect(styleValue).to.equal(IFRAME_STYLES[key].toString());
      console.log(styleValue, key, IFRAME_STYLES[key]);
    }
  });

  it('should have created label and link', function* () {
    yield notificationView.start();
    const iframe = notificationView.notificationContainer;
    const iframeDoc = iframe.contentDocument;
    expect(notificationView).to.be.defined;
    expect(iframe).to.be.defined;
    expect(iframe.srcdoc).to.equal('<h1>Fake iframe</h1>');

    expect(iframeDoc.querySelector(`.${NOTIFICATION_LABEL_CLASS}`).textContent)
        .to.equal(NOTIFICATION_LABEL);

    expect(iframeDoc.querySelector(`.${NOTIFICATION_DETAIL_CLASS}`).textContent)
        .to.equal(NOTIFICATION_DETAIL_LABEL);

    expect(iframeDoc.querySelector(`.${NOTIFICATION_DETAIL_CLASS}`)
        .getAttribute('aria-label')).to.equal(NOTIFICATION_DETAIL_ARIA_LABEL);
  });
});
