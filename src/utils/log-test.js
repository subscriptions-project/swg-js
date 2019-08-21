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

/* eslint-disable */

import {assert, debugLog} from './log';

describes.realWin('debug log', {}, () => {
  let log;

  beforeEach(() => {
    log = sandbox.spy(console, 'log');
  });

  afterEach(() => {
    log.restore();
  });

  it('should log if swg.debug=1', () => {
    self.location.hash = 'swg.debug=1';
    debugLog('Hello World');
    expect(console.log.calledWith('[Subscriptions]', 'Hello World')).to.be.true;
  });

  it('should handle multiple arguments', () => {
    self.location.hash = 'swg.debug=1';
    debugLog('Hello', 'World');
    expect(console.log.calledWith('[Subscriptions]', 'Hello', 'World')).to.be
      .true;
  });

  it('should not log if swg.debug=1 is not present', () => {
    self.location.hash = '';
    debugLog('Hello World');
    expect(console.log.notCalled).to.be.true;
  });
});

describes.realWin('asserts', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  it('should fail', () => {
    expect(function() {
      assert(false, 'xyz');
    }).to.throw(/xyz/);
    try {
      assert(false, '123');
    } catch (e) {
      expect(e.message).to.equal('123');
      return;
    }
    // Unreachable
    expect(false).to.be.true;
  });

  it('should not fail', () => {
    assert(true, 'True!');
    assert(1, '1');
    assert('abc', 'abc');
  });

  it('should substitute', () => {
    expect(function() {
      assert(false, 'should fail %s', 'XYZ');
    }).to.throw(/should fail XYZ/);
    expect(function() {
      assert(false, 'should fail %s %s', 'XYZ', 'YYY');
    }).to.throw(/should fail XYZ YYY/);
    const div = win.document.createElement('div');
    div.id = 'abc';
    div.textContent = 'foo';
    expect(function() {
      assert(false, 'should fail %s', div);
    }).to.throw(/should fail div#abc/);

    let error;
    try {
      assert(false, '%s a %s b %s', 1, 2, 3);
    } catch (e) {
      error = e;
    }
    expect(error).to.be.instanceof(Error);
    expect(error.message).to.equal('1 a 2 b 3');
    expect(error.messageArray).to.deep.equal([1, 'a', 2, 'b', 3]);
  });

  it('should add element and assert info', () => {
    const div = win.document.createElement('div');
    let error;
    try {
      assert(false, '%s a %s b %s', div, 2, 3);
    } catch (e) {
      error = e;
    }
    expect(error).to.be.instanceof(Error);
    expect(error.associatedElement).to.equal(div);
    expect(error.fromAssert).to.equal(true);
  });
});
