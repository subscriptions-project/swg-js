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

import {assign, install} from './object-assign';

describes.sandboxed('Object.assign polyfill', {}, () => {
  it('should assign values', () => {
    const obj1 = {x: 1};
    obj1.__proto__ = {y: 2};
    const obj2 = {z: 2};

    expect(
      assign({}, null, undefined, () => {}, 1, 'abc', false, obj1, obj2)
    ).to.deep.equal(
      Object.assign({}, null, undefined, () => {}, 1, 'abc', false, obj1, obj2)
    );
  });

  it('should throw if passed undefined or null object', () => {
    const values = [null, undefined];
    for (const val of values) {
      expect(() => assign(val)).to.throw(
        'Cannot convert undefined or null to object'
      );
    }
  });

  it('should install if necessary', () => {
    // Polyfill won't be installed if it isn't needed.
    expect(self.Object.assign).to.not.equal(assign);
    install(self);
    expect(self.Object.assign).to.not.equal(assign);

    // Delete native method.
    const backup = self.Object.assign;
    delete self.Object.assign;

    // Install polyfill.
    install(self);
    expect(self.Object.assign).to.equal(assign);

    // Restore native method.
    self.Object.assign = backup;
    expect(self.Object.assign).to.not.equal(assign);
  });
});
