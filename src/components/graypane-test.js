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

import {GlobalDoc} from '../model/doc';
import {Graypane} from './graypane';
import {getStyle} from '../utils/style';

const NO_ANIMATE = false;
const ANIMATE = true;

describes.realWin('Graypane', {}, env => {
  let win;
  let graypane;
  let element;

  beforeEach(() => {
    win = env.win;
    graypane = new Graypane(new GlobalDoc(win), 17);
    element = graypane.getElement();
  });

  it('should assign z-index', () => {
    expect(getStyle(element, 'z-index')).to.equal('17');
  });

  it('should style correctly', () => {
    expect(getStyle(element, 'display')).to.equal('none');
    expect(getStyle(element, 'position')).to.equal('fixed');
    expect(getStyle(element, 'top')).to.equal('0px');
    expect(getStyle(element, 'left')).to.equal('0px');
    expect(getStyle(element, 'right')).to.equal('0px');
    expect(getStyle(element, 'bottom')).to.equal('0px');
    expect(getStyle(element, 'background-color')).to.equal(
      'rgba(32, 33, 36, 0.6)'
    );
  });

  it('should attach and destroy', () => {
    expect(element.parentNode).to.be.null;
    graypane.attach();
    expect(element.parentNode).to.equal(win.document.body);

    graypane.destroy();
    expect(element.parentNode).to.be.null;
  });

  it('should show w/o animation', () => {
    graypane.attach();
    const p = graypane.show(NO_ANIMATE);
    expect(p).to.be.undefined;
    expect(getStyle(element, 'display')).to.equal('block');
    expect(getStyle(element, 'opacity')).to.equal('1');
  });

  it('should show w/animation', async () => {
    graypane.attach();
    const p = graypane.show(ANIMATE);
    expect(p).to.exist;
    expect(getStyle(element, 'display')).to.equal('block');
    expect(getStyle(element, 'opacity')).to.equal('0');

    await p;
    expect(getStyle(element, 'opacity')).to.equal('1');
  });

  it('should hide w/o animation', () => {
    graypane.attach();
    graypane.show(NO_ANIMATE);
    const p = graypane.hide(NO_ANIMATE);
    expect(p).to.be.undefined;
    expect(getStyle(element, 'display')).to.equal('none');
  });

  it('should hide w/animation', async () => {
    graypane.attach();
    graypane.show(NO_ANIMATE);
    const p = graypane.hide(ANIMATE);
    expect(p).to.exist;
    expect(getStyle(element, 'display')).to.equal('block');
    expect(getStyle(element, 'opacity')).to.equal('1');

    await p;
    expect(getStyle(element, 'display')).to.equal('none');
    expect(getStyle(element, 'opacity')).to.equal('0');
  });
});
