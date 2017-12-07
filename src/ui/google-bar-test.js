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

import {GoogleBar} from './google-bar';
import {injectStyleSheet} from '../utils/dom';
import {CSS as GOOGLE_BAR_CSS} from '../../build/css/ui/google-bar.css';

describes.realWin('GoogleBar', {} , env => {
  let win;
  let doc;
  let googleBar;

  beforeEach(() => {
    win = env.win;
    doc = win.document;
    injectStyleSheet(doc, GOOGLE_BAR_CSS);
    googleBar = new GoogleBar(win);
  });

  it('should have created a Google bar', () => {
    const gBar = googleBar.getElement();

    // Inject to body, to validate styles.
    doc.body.append(gBar);

    expect(gBar.getAttribute('class')).to.equal('swg-google-bar');
    expect(win.getComputedStyle(gBar)
        .getPropertyValue('height')).to.equal('4px');
    expect(win.getComputedStyle(gBar)
        .getPropertyValue('padding')).to.equal('0px');
    expect(win.getComputedStyle(gBar)
        .getPropertyValue('margin')).to.equal('0px');
    expect(win.getComputedStyle(gBar)
        .getPropertyValue('display')).to.equal('flex');

    expect(gBar.children.length).to.equal(4);

    const firstChild = gBar.children[0];
    expect(firstChild.getAttribute('class')).to.equal('swg-bar');
    expect(win.getComputedStyle(firstChild)
        .getPropertyValue('background-color')).to.equal('rgb(66, 133, 244)');
  });
});
