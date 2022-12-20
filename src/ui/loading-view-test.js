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

import {UI_CSS as LOADING_VIEW_CSS} from '../ui/ui-css';
import {LoadingView} from './loading-view';
import {injectStyleSheet} from '../utils/dom';
import {resolveDoc} from '../model/doc';

describes.realWin('LoadingView', (env) => {
  let doc;
  let win;
  let body;
  let loadingView;
  let loadingContainer;
  const hiddenStyle = 'display: none !important;';

  beforeEach(() => {
    win = env.win;
    doc = env.win.document;
    body = doc.body;
    injectStyleSheet(resolveDoc(doc), LOADING_VIEW_CSS);
  });

  describe('loadingView', () => {
    beforeEach(() => {
      loadingView = new LoadingView(doc);
      body.appendChild(loadingView.getElement());
      loadingContainer = body.querySelector('swg-loading-container');
    });

    it('should have rendered the loading indicator in <BODY>', () => {
      expect(loadingView).to.exist;
      assert.isFunction(loadingView.show);
      assert.isFunction(loadingView.hide);

      // Should have injected styles applied.
      const loadingTagStyles = win.getComputedStyle(loadingContainer);

      expect(loadingTagStyles.bottom).to.equal('0px');
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

  describe('with config.additionalClasses', () => {
    beforeEach(() => {
      loadingView = new LoadingView(doc, {additionalClasses: ['foo', 'bar']});
      body.appendChild(loadingView.getElement());
      loadingContainer = body.querySelector('swg-loading-container');
    });

    it('adds additionalClasses to loading container', () => {
      expect(loadingContainer).to.have.class('foo');
      expect(loadingContainer).to.have.class('bar');
    });
  });
});
