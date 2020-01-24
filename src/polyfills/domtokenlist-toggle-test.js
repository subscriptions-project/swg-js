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

import {install, toggle} from './domtokenlist-toggle';

describes.sandboxed('DOMTokenList.prototype.toggle polyfill', {}, () => {
  let ieWin;
  let chromeWin;
  const fn = () => {};

  /** Creates fake window object with a given user agent. */
  function createWin(userAgent) {
    return {
      DOMTokenList: {prototype: {toggle: fn}},
      Object: {defineProperty: Object.defineProperty},
      navigator: {
        userAgent,
      },
    };
  }

  /** Creates a DOMTokenList from a freshly created element. */
  function createList() {
    const el = self.document.createElement('div');
    el.classList.add('default-class');
    return el.classList;
  }

  beforeEach(() => {
    chromeWin = createWin(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36'
    );
    ieWin = createWin(
      'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko'
    );
  });

  it('should determine whether array includes given value', () => {
    const tokenParams = ['a', 'b', 'c'];
    const forceParams = [undefined, false, true];
    for (const token of tokenParams) {
      for (const force of forceParams) {
        expect(toggle.call(createList(), token, force).toString()).to.equal(
          DOMTokenList.prototype.toggle
            .call(createList(), token, force)
            .toString()
        );
      }
    }
  });

  it('should install if necessary', () => {
    // Polyfill won't be installed for Chrome.
    expect(chromeWin.DOMTokenList.prototype.toggle).to.not.equal(toggle);
    install(chromeWin);
    expect(chromeWin.DOMTokenList.prototype.toggle).to.not.equal(toggle);

    // Polyfill will be installed for IE.
    expect(ieWin.DOMTokenList.prototype.toggle).to.not.equal(toggle);
    install(ieWin);
    expect(ieWin.DOMTokenList.prototype.toggle).to.equal(toggle);
  });
});
