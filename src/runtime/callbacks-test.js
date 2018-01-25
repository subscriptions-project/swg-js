/**
 * Copyright 2017 The __PROJECT__ Authors. All Rights Reserved.
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

import {Callbacks} from './callbacks';


describes.sandboxed('Callbacks', {}, () => {
  let callbacks;

  beforeEach(() => {
    callbacks = new Callbacks();
  });

  function skipMicro() {
    return Promise.resolve().then(() => {
      return Promise.resolve().then(() => {});
    });
  }

  it('should schedule and trigger callback', () => {
    const spy1 = sandbox.spy();
    const spy2 = sandbox.spy();
    callbacks.setCallback_(1, spy1);
    callbacks.setCallback_(2, spy2);
    expect(spy1).to.not.be.called;
    expect(spy2).to.not.be.called;
    return skipMicro().then(() => {
      expect(spy1).to.not.be.called;
      expect(spy2).to.not.be.called;
      callbacks.trigger_(1, 'one');
      return skipMicro();
    }).then(() => {
      expect(spy1).to.be.calledOnce;
      expect(spy1).to.be.calledWith('one');
      expect(spy2).to.not.be.called;
      callbacks.trigger_(2, 'two');
      return skipMicro();
    }).then(() => {
      expect(spy1).to.be.calledOnce;
      expect(spy1).to.be.calledWith('one');
      expect(spy2).to.be.calledOnce;
      expect(spy2).to.be.calledWith('two');
    });
  });

  it('should trigger first can callback later', () => {
    const spy1 = sandbox.spy();
    const spy2 = sandbox.spy();
    callbacks.trigger_(1, 'one');
    callbacks.trigger_(2, 'two');
    callbacks.setCallback_(1, spy1);
    callbacks.setCallback_(2, spy2);
    expect(spy1).to.not.be.called;
    expect(spy2).to.not.be.called;
    return skipMicro().then(() => {
      expect(spy1).to.be.calledOnce;
      expect(spy1).to.be.calledWith('one');
      expect(spy2).to.be.calledOnce;
      expect(spy2).to.be.calledWith('two');
    });
  });

  it('should trigger and execute linkComplete', () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy);
    callbacks.triggerLinkComplete(p);
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce;
      expect(spy).to.be.calledWith(p);
    });
  });

  it('should trigger and execute subscribeResponse', () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy);  // Make sure there's no ID conflict.
    callbacks.setOnSubscribeResponse(spy);
    callbacks.triggerSubscribeResponse(p);
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce;
      expect(spy).to.be.calledWith(p);
    });
  });
});
