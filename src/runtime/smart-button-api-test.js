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

import {SmartSubscriptionButtonApi} from './smart-button-api';

describes.realWin('SmartSubscriptionButtonApi', (env) => {
  let addDefaultArguments;
  let button;
  let deps;
  let smartButton;

  beforeEach(() => {
    addDefaultArguments = sandbox.fake();
    button = self.document.createElement('button');
    deps = {
      activities: () => ({
        addDefaultArguments,
        openIframe: () => Promise.resolve(),
      }),
      win: () => env.win,
      pageConfig: () => ({getPublicationId: () => '...'}),
    };
    smartButton = new SmartSubscriptionButtonApi(deps, button, {});
    smartButton.start();
  });

  it('sets iframe attributes', () => {
    expect(smartButton.iframe_.getAttribute('title')).to.equal(
      'Subscribe with Google Button'
    );
    expect(smartButton.iframe_.getAttribute('frameborder')).to.equal('0');
    expect(smartButton.iframe_.getAttribute('scrolling')).to.equal('no');
  });

  it('defaults theme to Theme.LIGHT', () => {
    expect(addDefaultArguments).to.be.calledWithExactly({
      publicationId: '...',
      theme: 'light',
      lang: 'en',
      _client: 'SwG 0.0.0',
    });
  });
});
