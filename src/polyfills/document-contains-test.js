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

import {contains, install} from './document-contains';

describes.sandboxed('HTMLDocument.prototype.contains polyfill', {}, () => {
  const doc = self.document;

  it('should determine whether document contains given node', () => {
    const connectedEl = doc.createElement('div');
    doc.body.appendChild(connectedEl);
    const disconnectedEl = doc.createElement('div');
    const valueParams = [connectedEl, disconnectedEl];
    valueParams.forEach(val => {
      expect(contains.call(doc, val)).to.deep.equal(
        HTMLDocument.prototype.contains.call(doc, val)
      );
    });
  });

  it('should install if necessary', () => {
    // Polyfill won't be installed if it isn't needed.
    expect(self.HTMLDocument.prototype.contains).to.not.equal(contains);
    install(self);
    expect(self.HTMLDocument.prototype.contains).to.not.equal(contains);

    // Delete native method.
    const backup = self.HTMLDocument.prototype.contains;
    self.HTMLDocument.prototype.contains = undefined;

    // Install polyfill.
    install(self);
    expect(self.HTMLDocument.prototype.contains).to.equal(contains);

    // Restore native method.
    self.HTMLDocument.prototype.contains = backup;
    expect(self.HTMLDocument.prototype.contains).to.not.equal(contains);
  });
});
