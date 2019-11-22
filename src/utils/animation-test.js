/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import {getStyle} from './style';
import {transition} from './animation';

describes.sandboxed('transition', {}, () => {
  let doc;
  let clock;
  let el;

  beforeEach(() => {
    clock = sandbox.useFakeTimers();
    doc = self.document;
    el = doc.createElement('div');
    doc.body.appendChild(el);
  });

  afterEach(() => {
    doc.body.removeChild(el);
  });

  it('should set transition', async () => {
    const promise = transition(
      el,
      {
        transform: 'translateY(11px)',
      },
      100,
      'ease-in'
    );
    clock.tick(1);
    expect(getStyle(el, 'transform')).to.equal('translateY(11px)');
    const transitionStyle = getStyle(el, 'transition');
    expect(transitionStyle.includes('transform 100ms ease-in')).to.be.true;
    expect(transitionStyle.includes('opacity 100ms ease-in')).to.be.true;
    clock.tick(100);

    await promise;
    expect(getStyle(el, 'transition')).to.equal('');
  });
});
