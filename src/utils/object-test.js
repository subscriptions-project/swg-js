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

import {findInArray, map} from './object';

describe('map', () => {
  it('should return a map-like object', () => {
    const obj = {a: 1, b: 2};
    expect(map(obj)).should.be.an('object');
    expect(map(obj)).to.deep.equal(obj);
    expect(map()).to.deep.equal({});
  });
});

describes.sandboxed('findInArray', {}, () => {
  it('should find a value', () => {
    const array = [1, 2, 3, 4];
    expect(findInArray(array, num => num > 2)).to.equal(3);
  });

  it('should supply all arguments', () => {
    const array = [1];
    const spy = sandbox.spy();
    findInArray(array, spy);
    expect(spy).to.be.calledOnce;
    expect(spy.args[0][0]).to.equal(1);
    expect(spy.args[0][1]).to.equal(0);
    expect(spy.args[0][2]).to.equal(array);
    expect(spy.args[0][3]).to.be.undefined;
  });
});
