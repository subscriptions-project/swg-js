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

import {assert, debugLog, warn} from './log';

describes.realWin('warn', () => {
  let warnFn;

  beforeEach(() => {
    warnFn = sandbox.spy(self.console, 'warn');
  });

  afterEach(() => {
    warnFn.restore();
  });

  it('should log a warning', () => {
    warn('Hello World');
    expect(self.console.warn).to.be.calledWith('Hello World');
  });
});

describes.realWin('debug log', () => {
  let log;

  beforeEach(() => {
    log = sandbox.spy(self.console, 'log');
  });

  afterEach(() => {
    log.restore();
  });

  it('should log if swg.debug=1', () => {
    self.location.hash = 'swg.debug=1';
    debugLog('Hello World');
    expect(self.console.log).to.be.calledWith('[Subscriptions]', 'Hello World');
  });

  it('should handle multiple arguments', () => {
    self.location.hash = 'swg.debug=1';
    debugLog('Hello', 'World');
    expect(self.console.log).to.be.calledWith(
      '[Subscriptions]',
      'Hello',
      'World'
    );
  });

  it('should not log if swg.debug=1 is not present', () => {
    self.location.hash = '';
    debugLog('Hello World');
    expect(self.console.log).to.not.be.called;
  });
});

describes.realWin('asserts', (env) => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  it('should fail', () => {
    expect(() => {
      assert(false, 'xyz');
    }).to.throw(/xyz/);
  });

  it('should not fail', () => {
    assert(true, 'True!');
    assert(1, '1');
    assert('abc', 'abc');
  });

  it('should substitute', () => {
    expect(() => {
      assert(false, 'should fail %s', 'XYZ');
    }).to.throw(/should fail XYZ/);

    expect(() => {
      assert(false, 'should fail %s %s', 'XYZ', 'YYY');
    }).to.throw(/should fail XYZ YYY/);

    const div = win.document.createElement('div');
    div.id = 'abc';
    div.textContent = 'foo';
    expect(() => {
      assert(false, 'should fail %s', div);
    }).to.throw(/should fail div#abc/);

    expect(() => assert(false, '%s a %s b %s', 1, 2, 3)).to.throw('1 a 2 b 3');
  });
});
