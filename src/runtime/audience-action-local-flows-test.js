/**
 * Copyright 2023 The Subscribe with Google Authors. All Rights Reserved.
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

import {AudienceActionLocalFlow} from './audience-action-local-flow';
import {ConfiguredRuntime} from './runtime';
import {PageConfig} from '../model/page-config';
import {Toast} from '../ui/toast';

describes.realWin('AudienceActionLocalFlow', (env) => {
  let flow;

  beforeEach(() => {
    const runtime = new ConfiguredRuntime(
      env.win,
      new PageConfig(
        /* productOrPublicationId= */ 'pub1:label1',
        /* locked= */ true
      ),
      /* integr= */ undefined,
      /* config= */ undefined,
      /* clientOptions= */ {}
    );
    flow = new AudienceActionLocalFlow(runtime);
  });

  describe('start', () => {
    it('renders with default prompt', async () => {
      await flow.start();

      const wrapper = env.win.document.querySelector(
        '.audience-action-local-wrapper'
      );
      expect(wrapper).to.not.be.null;
      const prompt = wrapper.shadowRoot.querySelector('.prompt');
      expect(prompt.innerHTML).contains('Invalid prompt.');
    });
  });

  describe('showNoEntitlementFoundToast', () => {
    it('opens toast', async () => {
      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      await flow.showNoEntitlementFoundToast();

      expect(toastOpenStub).to.be.called.calledWithExactly();
    });
  });
});
