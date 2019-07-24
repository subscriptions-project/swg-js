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
      expect(callbacks.trigger_(1, 'one')).to.be.true;
      return skipMicro();
    }).then(() => {
      expect(spy1).to.be.calledOnce;
      expect(spy1).to.be.calledWith('one');
      expect(spy2).to.not.be.called;
      expect(callbacks.trigger_(2, 'two')).to.be.true;
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
    expect(callbacks.trigger_(1, 'one')).to.be.false;
    expect(callbacks.trigger_(2, 'two')).to.be.false;
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

  it('should trigger and execute linkProgress', () => {
    const spy = sandbox.spy();
    callbacks.setOnLinkProgress(spy);
    expect(callbacks.triggerLinkProgress()).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWithExactly(true);
    });
  });

  it('should trigger and execute linkComplete', () => {
    const spy = sandbox.spy();
    callbacks.setOnLinkComplete(spy);
    expect(callbacks.hasLinkCompletePending()).to.be.false;
    expect(callbacks.triggerLinkComplete()).to.be.true;
    expect(callbacks.hasLinkCompletePending()).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWithExactly(true);
      expect(callbacks.hasLinkCompletePending()).to.be.false;
    });
  });

  it('should trigger and execute loginRequest', () => {
    const spy = sandbox.spy();
    callbacks.setOnLoginRequest(spy);
    expect(callbacks.triggerLoginRequest({linkRequested: true})).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith({linkRequested: true});
    });
  });

  it('should trigger and execute subscribeRequest', () => {
    const spy = sandbox.spy();
    expect(callbacks.hasSubscribeRequestCallback()).to.be.false;
    callbacks.setOnSubscribeRequest(spy);
    expect(callbacks.hasSubscribeRequestCallback()).to.be.true;
    expect(callbacks.triggerSubscribeRequest()).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWithExactly(true);
      expect(callbacks.hasSubscribeRequestCallback()).to.be.true;
    });
  });

  it('should trigger and execute subscribeResponse', () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy); // Make sure there's no ID conflict.
    callbacks.setOnSubscribeResponse(spy);
    expect(callbacks.hasLinkCompletePending()).to.be.false;
    expect(callbacks.hasSubscribeResponsePending()).to.be.false;
    expect(callbacks.triggerSubscribeResponse(p)).to.be.true;
    expect(callbacks.hasSubscribeResponsePending()).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith(p);
      expect(callbacks.hasSubscribeResponsePending()).to.be.false;
    });
  });

  it('should trigger and execute ContributionResponse', () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy); // Make sure there's no ID conflict.
    callbacks.setOnContributionResponse(spy);
    expect(callbacks.hasLinkCompletePending()).to.be.false;
    expect(callbacks.hasSubscribeResponsePending()).to.be.false;
    expect(callbacks.triggerContributionResponse(p)).to.be.true;
    expect(callbacks.hasContributionResponsePending()).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith(p);
      expect(callbacks.hasContributionResponsePending()).to.be.false;
    });
  });

  it('should trigger and execute entitlementsResponse', () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy); // Make sure there's no ID conflict.
    callbacks.setOnEntitlementsResponse(spy);
    expect(callbacks.triggerEntitlementsResponse(p)).to.be.true;
    expect(callbacks.hasLinkCompletePending()).to.be.false;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith(p);
    });
  });

  it('should trigger and execute flowStarted', () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowCanceled(spy); // Make sure there's no ID conflict.
    callbacks.setOnFlowStarted(spy);
    expect(callbacks.triggerFlowStarted('flow1')).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {}});
    });
  });

  it('should trigger and execute flowStarted with data', () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowStarted(spy);
    callbacks.triggerFlowStarted('flow1', {a: 1});
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {a: 1}});
    });
  });

  it('should trigger and execute flowCanceled', () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowStarted(spy); // Make sure there's no ID conflict.
    callbacks.setOnFlowCanceled(spy);
    expect(callbacks.triggerFlowCanceled('flow1')).to.be.true;
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {}});
    });
  });

  it('should trigger and execute flowCanceled with data', () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowCanceled(spy);
    callbacks.triggerFlowCanceled('flow1', {a: 1});
    return skipMicro().then(() => {
      expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {a: 1}});
    });
  });
});
