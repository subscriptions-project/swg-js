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

import {install, sign} from './math-sign';

describes.sandboxed('Math.sign polyfill', {}, () => {
  it('should determine sign', () => {
    const values = [-8, 0, 8, null, undefined, '', () => {}];
    for (const val of values) {
      expect(sign(val)).to.deep.equal(Math.sign(val));
    }
  });

  it('should install if necessary', () => {
    // Polyfill won't be installed if it isn't needed.
    expect(self.Math.sign).to.not.equal(sign);
    install(self);
    expect(self.Math.sign).to.not.equal(sign);

    // Delete native method.
    const backup = self.Math.sign;
    delete self.Math.sign;

    // Install polyfill.
    install(self);
    expect(self.Math.sign).to.equal(sign);

    // Restore native method.
    self.Math.sign = backup;
    expect(self.Math.sign).to.not.equal(sign);
  });
});
