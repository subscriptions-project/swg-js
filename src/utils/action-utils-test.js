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

import {DepsDef} from '../runtime/deps';
import {isGtagEligible} from './action-utils';

let deps;
let win;

describes.sandboxed('isGtagEligible', {}, () => {
  it('should return true with valid gtag', async () => {
    deps = new DepsDef();
    win = {
      'gtag': () => {},
    };
    sandbox.stub(deps, 'win').returns(win);

    const isEligible = isGtagEligible(deps);
    expect(isEligible).to.be.true;
  });

  it('should return false with undefined gtag', async () => {
    deps = new DepsDef();
    win = {};
    sandbox.stub(deps, 'win').returns(win);

    const isEligible = isGtagEligible(deps);
    expect(isEligible).to.be.false;
  });
});
