/**
 * Copyright 2025 The Subscribe with Google Authors. All Rights Reserved.
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

import {GlobalDoc} from '../model/doc';
import {MockDeps} from '../../test/mock-deps';
import {Toast} from '../ui/toast';
import {showAlreadyOptedInToast} from './cta-utils';

describes.realWin('CTA utils', (env) => {
  let deps;
  let win;
  let doc;
  let toast;
  let toastOpenStub;
  beforeEach(() => {
    deps = new MockDeps();
    win = Object.assign({}, env.win, {});
    sandbox.stub(deps, 'win').returns(win);
    doc = new GlobalDoc(win);
    sandbox.stub(deps, 'doc').returns(doc);
  });

  describe('showAlreadyOptedInToast', () => {
    it('showAlreadyOptedInToast shows basic toast for regwall', () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      showAlreadyOptedInToast('TYPE_REGISTRATION_WALL', 'en', deps);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=basic');
    });

    it('showAlreadyOptedInToast shows custom toast for newsletter', () => {
      toastOpenStub = sandbox
        .stub(Toast.prototype, 'open')
        .callsFake(function () {
          toast = this;
        });

      showAlreadyOptedInToast('TYPE_NEWSLETTER_SIGNUP', 'en', deps);

      expect(toastOpenStub).to.be.called;
      expect(toast).not.to.be.null;
      expect(toast.src_).to.contain('flavor=custom');
      expect(decodeURI(toast.src_)).to.contain('You have signed up before.');
    });

    it('showAlreadyOptedInToast show no toast if other types', () => {
      const toastOpenStub = sandbox.stub(Toast.prototype, 'open');

      showAlreadyOptedInToast('TYPE_REWARDED_SURVEY', 'en', deps);

      expect(toastOpenStub).not.to.be.called;
    });
  });
});
