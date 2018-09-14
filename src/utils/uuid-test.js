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

import {
  uuidFast,
} from './uuid';

describe('gets new UUID', () => {
  it('should generate unique UUID.', () => {
    expect(uuidFast().length).to.equal(36);
    const uuidItems = uuidFast().split('-');
    expect(uuidItems.length).to.equal(5);
    expect(uuidItems[0].length).to.equal(8);
    expect(uuidItems[1].length).to.equal(4);
    expect(uuidItems[2].length).to.equal(4);
    expect(uuidItems[3].length).to.equal(4);
    expect(uuidItems[4].length).to.equal(12);
    const firstUuid = uuidFast();
    const secondUuid = uuidFast();
    const thirdUuid = uuidFast();
    expect(firstUuid).to.not.equal(secondUuid);
    expect(firstUuid).to.not.equal(thirdUuid);
    expect(secondUuid).to.not.equal(thirdUuid);
  });
});
