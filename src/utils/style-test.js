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

import * as st from './style';

describes.realWin('Types', (env) => {
  let win;
  let doc;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
  });

  describe('Style', () => {
    it('check defaultStyle for restricted attributes', () => {
      const defaultStyles = st.defaultStyles;

      expect(defaultStyles.width).to.equal(undefined);
      expect(defaultStyles.left).to.equal(undefined);
      expect(defaultStyles['margin-left']).to.equal(undefined);
    });

    it('setStyle', () => {
      const element = doc.createElement('div');
      st.setStyle(element, 'width', '1px');
      expect(element.style.width).to.equal('1px');
    });

    it('setStyles', () => {
      const element = doc.createElement('div');
      st.setStyles(element, {
        width: '101px',
        height: '102px',
      });
      expect(element.style.width).to.equal('101px');
      expect(element.style.height).to.equal('102px');
    });

    it('getStyle handles missing property', () => {
      const element = doc.createElement('div');
      const style = st.getStyle(element, 'invalid-property');
      expect(style).to.equal('');
    });

    it('resetAllStyles', () => {
      const element = doc.createElement('div');
      st.resetAllStyles(element);
      expect(element.style.objectFit).to.equal('fill');
      expect(element.style.opacity).to.equal('1');
      expect(element.style.display).to.equal('block');
    });
  });
});
