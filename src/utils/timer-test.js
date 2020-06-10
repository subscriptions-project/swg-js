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

import {Timer} from './timer';

describes.realWin('Timer', {}, (env) => {
  let windowMock;
  let timer;

  beforeEach(() => {
    const WindowApi = function () {};
    WindowApi.prototype.setTimeout = function (unusedCallback, unusedDelay) {};
    WindowApi.prototype.clearTimeout = function (unusedTimerId) {};
    WindowApi.prototype.document = {};
    const windowApi = new WindowApi();
    windowMock = sandbox.mock(windowApi);

    timer = new Timer(windowApi);
  });

  afterEach(() => {
    windowMock.verify();
    sandbox.restore();
  });

  it('delay', () => {
    const handler = () => {};
    windowMock.expects('setTimeout').returns(1).once();
    windowMock.expects('clearTimeout').never();
    timer.delay(handler, 111);
  });

  it('delay 0 real window', (done) => {
    timer = new Timer(self);
    timer.delay(done, 0);
  });

  it('delay 1 real window', (done) => {
    timer = new Timer(self);
    timer.delay(done, 1);
  });

  it('delay default', (done) => {
    windowMock.expects('setTimeout').never();
    windowMock.expects('clearTimeout').never();
    timer.delay(done);
  });

  it('cancel', () => {
    windowMock.expects('clearTimeout').withExactArgs(1).once();
    timer.cancel(1);
  });

  it('cancel default', (done) => {
    windowMock.expects('setTimeout').never();
    windowMock.expects('clearTimeout').never();
    const mock = sandbox.mock();
    const id = timer.delay(mock);
    timer.cancel(id);

    // This makes sure the error has time to throw while this test
    // is still running.
    timer.delay(done);
    expect(mock).to.not.have.been.called;
  });

  it('promise', async () => {
    windowMock
      .expects('setTimeout')
      .withExactArgs(
        sandbox.match((value) => {
          value();
          return true;
        }),
        111
      )
      .returns(1)
      .once();

    const result = await timer.promise(111);
    expect(result).to.be.undefined;
  });

  it('timeoutPromise - no race', async () => {
    windowMock
      .expects('setTimeout')
      .withExactArgs(
        sandbox.match((value) => {
          value();
          return true;
        }),
        111
      )
      .returns(1)
      .once();

    await expect(timer.timeoutPromise(111)).to.be.rejectedWith(/timeout/);
  });

  it('timeoutPromise - race no timeout', async () => {
    windowMock
      .expects('setTimeout')
      .withExactArgs(
        sandbox.match((fn) => typeof fn === 'function'),
        111
      )
      .returns(1)
      .once();

    const result = await timer.timeoutPromise(111, Promise.resolve('A'));
    expect(result).to.equal('A');
  });

  it('timeoutPromise - race with timeout', async () => {
    windowMock
      .expects('setTimeout')
      .withExactArgs(
        sandbox.match((value) => {
          // Immediate timeout
          value();
          return true;
        }),
        111
      )
      .returns(1)
      .once();

    await expect(
      timer.timeoutPromise(111, new Promise(() => {}))
    ).to.be.rejectedWith(/timeout/);
  });

  it('poll - resolves only when condition is true', async () => {
    const realTimer = new Timer(env.win);
    let predicate = false;
    setTimeout(() => {
      predicate = true;
    }, 15);
    await realTimer.poll(10, () => predicate);
    expect(predicate).to.be.true;
  });

  it('poll - clears out interval when complete', async () => {
    const realTimer = new Timer(env.win);
    const clearIntervalStub = sandbox.stub();
    env.win.clearInterval = clearIntervalStub;
    await realTimer.poll(111, () => true);
    expect(clearIntervalStub).to.have.been.calledOnce;
  });
});
