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

import {includes, install} from './array-includes';

describes.sandboxed('Array.prototype.includes polyfill', {}, () => {
  it('should determine whether array includes given value', () => {
    const valueParams = [0, 1, 2, 7, NaN];
    const fromParams = [undefined, -1, 0, 1, 2];
    const list = [0, 1, 2, 3, 4, 5, 6, NaN];
    for (const val of valueParams) {
      for (const from of fromParams) {
        expect(includes.call(list, val, from)).to.deep.equal(
          Array.prototype.includes.call(list, val, from)
        );
      }
    }
  });

  it('should install if necessary', () => {
    // Polyfill won't be installed if it isn't needed.
    expect(self.Array.prototype.includes).to.not.equal(includes);
    install(self);
    expect(self.Array.prototype.includes).to.not.equal(includes);

    // Delete native method.
    const backup = self.Array.prototype.includes;
    delete self.Array.prototype.includes;

    // Install polyfill.
    install(self);
    expect(self.Array.prototype.includes).to.equal(includes);

    // Restore native method.
    self.Array.prototype.includes = backup;
    expect(self.Array.prototype.includes).to.not.equal(includes);
  });
});
