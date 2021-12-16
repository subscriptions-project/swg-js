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

import {ActivityIframeView} from '../ui/activity-iframe-view';
import {Callbacks} from './callbacks';
import {tick} from '../../test/tick';

describes.sandboxed('Callbacks', {}, () => {
  let callbacks;

  beforeEach(() => {
    callbacks = new Callbacks();
  });

  it('should schedule and trigger callback', async () => {
    const spy1 = sandbox.spy();
    const spy2 = sandbox.spy();
    callbacks.setCallback_(1, spy1);
    callbacks.setCallback_(2, spy2);
    expect(spy1).to.not.be.called;
    expect(spy2).to.not.be.called;

    await tick();
    expect(spy1).to.not.be.called;
    expect(spy2).to.not.be.called;
    expect(callbacks.trigger_(1, 'one')).to.be.true;

    await tick();
    expect(spy1).to.be.calledOnce;
    expect(spy1).to.be.calledWith('one');
    expect(spy2).to.not.be.called;
    expect(callbacks.trigger_(2, 'two')).to.be.true;

    await tick();
    expect(spy1).to.be.calledOnce;
    expect(spy1).to.be.calledWith('one');
    expect(spy2).to.be.calledOnce;
    expect(spy2).to.be.calledWith('two');
  });

  it('should trigger first can callback later', async () => {
    const spy1 = sandbox.spy();
    const spy2 = sandbox.spy();
    expect(callbacks.trigger_(1, 'one')).to.be.false;
    expect(callbacks.trigger_(2, 'two')).to.be.false;
    callbacks.setCallback_(1, spy1);
    callbacks.setCallback_(2, spy2);
    expect(spy1).to.not.be.called;
    expect(spy2).to.not.be.called;

    await tick();
    expect(spy1).to.be.calledOnce;
    expect(spy1).to.be.calledWith('one');
    expect(spy2).to.be.calledOnce;
    expect(spy2).to.be.calledWith('two');
  });

  it('should trigger and execute linkProgress', async () => {
    const spy = sandbox.spy();
    callbacks.setOnLinkProgress(spy);
    expect(callbacks.triggerLinkProgress()).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWithExactly(true);
  });

  it('should trigger and execute linkComplete', async () => {
    const spy = sandbox.spy();
    callbacks.setOnLinkComplete(spy);
    expect(callbacks.hasLinkCompletePending()).to.be.false;
    expect(callbacks.triggerLinkComplete()).to.be.true;
    expect(callbacks.hasLinkCompletePending()).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWithExactly(true);
    expect(callbacks.hasLinkCompletePending()).to.be.false;
  });

  it('should trigger and execute loginRequest', async () => {
    const spy = sandbox.spy();
    callbacks.setOnLoginRequest(spy);
    expect(callbacks.triggerLoginRequest({linkRequested: true})).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWith({linkRequested: true});
  });

  it('triggers and executes payConfirmOpened', async () => {
    const spy = sandbox.spy();
    callbacks.setOnPayConfirmOpened(spy);

    const activityIframeView = new ActivityIframeView(self, null, 'src', {});
    expect(callbacks.triggerPayConfirmOpened(activityIframeView)).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWith(activityIframeView);
  });

  it('should trigger and execute subscribeRequest', async () => {
    const spy = sandbox.spy();
    expect(callbacks.hasSubscribeRequestCallback()).to.be.false;
    callbacks.setOnSubscribeRequest(spy);
    expect(callbacks.hasSubscribeRequestCallback()).to.be.true;
    expect(callbacks.triggerSubscribeRequest()).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWithExactly(true);
    expect(callbacks.hasSubscribeRequestCallback()).to.be.true;
  });

  describe('paymentResponse triggering', () => {
    let spy;
    let resolver;
    let failer;
    let paymentResponsePromise;

    beforeEach(() => {
      spy = sandbox.spy();
      paymentResponsePromise = new Promise((resolve, fail) => {
        resolver = resolve;
        failer = fail;
      });
      callbacks.setOnLinkComplete(spy); // Make sure there's no ID conflict.
      callbacks.setOnPaymentResponse(spy);
      expect(callbacks.hasLinkCompletePending()).to.be.false;
      expect(callbacks.hasPaymentResponsePending()).to.be.false;
      expect(callbacks.triggerPaymentResponse(paymentResponsePromise)).to.be
        .true;
      // Should wait for the passed promise to resolve.
      expect(callbacks.hasPaymentResponsePending()).to.be.false;
    });

    it('should work with a response', async () => {
      await resolver({
        clone: () => {},
      });
      // Now its pending until the next tick
      expect(callbacks.hasPaymentResponsePending()).to.be.true;
      await callbacks.paymentResponsePromise_;
      // Now everything should execute
      expect(spy).to.be.calledOnce.calledWith();
      expect(callbacks.hasPaymentResponsePending()).to.be.false;
    });

    it('should not throw user canceled errors', async () => {
      await failer({name: 'AbortError'});
      await callbacks.paymentResponsePromise_;
      await tick();
      // Now everything should execute
      expect(spy).to.not.be.called;
      expect(callbacks.hasPaymentResponsePending()).to.be.false;
    });

    it('should throw other errors', async () => {
      await failer({name: 'OtherError'});
      let receivedReason = null;
      await callbacks.paymentResponsePromise_.then(
        () => {},
        (reason) => {
          receivedReason = reason;
        }
      );
      await tick();
      // Now everything should execute
      expect(spy).to.not.be.called;
      expect(receivedReason).to.deep.equal({name: 'OtherError'});
      expect(callbacks.hasPaymentResponsePending()).to.be.false;
    });
  });

  it('should trigger and execute entitlementsResponse', async () => {
    const spy = sandbox.spy();
    const p = Promise.resolve();
    callbacks.setOnLinkComplete(spy); // Make sure there's no ID conflict.
    callbacks.setOnEntitlementsResponse(spy);
    expect(callbacks.triggerEntitlementsResponse(p)).to.be.true;
    expect(callbacks.hasLinkCompletePending()).to.be.false;

    await tick();
    expect(spy).to.be.calledOnce.calledWith();
  });

  it('should trigger and execute flowStarted', async () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowCanceled(spy); // Make sure there's no ID conflict.
    callbacks.setOnFlowStarted(spy);
    expect(callbacks.triggerFlowStarted('flow1')).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {}});
  });

  it('should trigger and execute flowStarted with data', async () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowStarted(spy);
    callbacks.triggerFlowStarted('flow1', {a: 1});

    await tick();
    expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {a: 1}});
  });

  it('should trigger and execute flowCanceled', async () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowStarted(spy); // Make sure there's no ID conflict.
    callbacks.setOnFlowCanceled(spy);
    expect(callbacks.triggerFlowCanceled('flow1')).to.be.true;

    await tick();
    expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {}});
  });

  it('should trigger and execute flowCanceled with data', async () => {
    const spy = sandbox.spy();
    callbacks.setOnFlowCanceled(spy);
    callbacks.triggerFlowCanceled('flow1', {a: 1});

    await tick();
    expect(spy).to.be.calledOnce.calledWith({flow: 'flow1', data: {a: 1}});
  });
});
