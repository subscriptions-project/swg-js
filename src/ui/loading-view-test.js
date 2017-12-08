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

import {injectStyleSheet} from '../utils/dom';
import {LoadingView} from './loading-view';
import {CSS as LOADING_VIEW_CSS} from '../../build/css/ui/loading-view.css';

describes.realWin('LoadingView', {}, env => {
  let doc;
  let body;
  let win;
  let loadingView;
  let loadingContainer;
  const hiddenStyle = 'display: none !important;';

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    body = doc.body;
    loadingView = new LoadingView(win, body);
    body.appendChild(loadingView.getElement());

    // TO test the injected styles have been applied.
    injectStyleSheet(doc, LOADING_VIEW_CSS);
    loadingContainer = body.querySelector('div[class="swg-loading"]');
  });

  describe('loadingView', () => {

    it('should have rendered the loading indicator in <BODY>', () => {
      expect(loadingView).to.be.defined;
      assert.isFunction(loadingView.show);
      assert.isFunction(loadingView.hide);

      // Should have injected styles applied.
      const loadingTagStyles =
          win.getComputedStyle(loadingContainer);

      // TODO(dparikh): Why position and transform values not populated?
      expect(loadingTagStyles.top).to.equal('50%');
      expect(loadingTagStyles.left).to.equal('50%');
      expect(loadingTagStyles['z-index']).to.equal('2147483647');

      expect(loadingContainer.children.length).to.equal(4);
    });

    it('should have hidden loading indicator', () => {
      expect(loadingContainer.getAttribute('style')).to.equal(hiddenStyle);
    });

    it('should show the loading indicator when called show()', () => {
      loadingView.show();
      expect(loadingContainer.getAttribute('style')).to.equal('');
    });

    it('should have hidden loading indicator when called hide()', () => {
      loadingView.hide();
      expect(loadingContainer.getAttribute('style')).to.equal(hiddenStyle);
    });
  });
});
