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
  isDocumentReady,
  onDocumentReady,
  whenDocumentComplete,
  whenDocumentReady,
} from './document-ready';
import {tick} from '../../test/tick';

describes.sandboxed('documentReady', {}, () => {
  let testDoc;
  let eventListeners;

  beforeEach(() => {
    eventListeners = {
      readystatechange: [],
    };

    testDoc = {
      readyState: 'loading',
      addEventListener: (eventType, handler) => {
        eventListeners[eventType].push(handler);
      },
      removeEventListener: (eventType, handler) => {
        eventListeners[eventType] = eventListeners[eventType].filter(
          fn => fn !== handler
        );
      },
    };
  });

  /** Calls listeners of the `readystatechange` event. */
  function callListeners() {
    for (const listener of eventListeners['readystatechange']) {
      listener();
    }
  }

  /** Counts listeners of the `readystatechange` event. */
  function countListeners() {
    return eventListeners['readystatechange'].length;
  }

  it('should interpret readyState correctly', () => {
    expect(isDocumentReady(testDoc)).to.equal(false);

    testDoc.readyState = 'uninitialized';
    expect(isDocumentReady(testDoc)).to.equal(false);

    testDoc.readyState = 'interactive';
    expect(isDocumentReady(testDoc)).to.equal(true);

    testDoc.readyState = 'complete';
    expect(isDocumentReady(testDoc)).to.equal(true);
  });

  it('should call callback immediately when ready', () => {
    testDoc.readyState = 'complete';
    const callback = sandbox.spy();
    onDocumentReady(testDoc, callback);
    expect(callback).to.be.calledOnce;
    expect(callback.getCall(0).args).to.deep.equal([testDoc]);
  });

  it('should wait to call callback until ready', () => {
    testDoc.readyState = 'loading';
    const callback = sandbox.spy();
    onDocumentReady(testDoc, callback);
    expect(callback).to.have.not.been.called;
    expect(countListeners()).to.equal(1);

    // Complete
    testDoc.readyState = 'complete';
    callListeners();
    expect(callback).to.be.calledOnce;
    expect(callback.getCall(0).args).to.deep.equal([testDoc]);
    expect(countListeners()).to.equal(0);
  });

  it('should wait to call callback for several loading events', () => {
    testDoc.readyState = 'loading';
    const callback = sandbox.spy();
    onDocumentReady(testDoc, callback);
    expect(callback).to.have.not.been.called;
    expect(countListeners()).to.equal(1);

    // Still loading
    callListeners();
    expect(callback).to.have.not.been.called;
    expect(countListeners()).to.equal(1);

    // Complete
    testDoc.readyState = 'complete';
    callListeners();
    expect(callback).to.be.calledOnce;
    expect(callback.getCall(0).args).to.deep.equal([testDoc]);
    expect(countListeners()).to.equal(0);
  });

  describe('whenDocumentReady', () => {
    it('should call callback immediately when ready', async () => {
      testDoc.readyState = 'complete';
      const spy = sandbox.spy();
      const spy2 = sandbox.spy();
      const spy3 = sandbox.spy();

      whenDocumentReady(testDoc)
        .then(spy)
        .then(spy2);

      whenDocumentReady(testDoc).then(spy3);

      expect(spy).to.have.not.been.called;
      expect(spy2).to.have.not.been.called;
      expect(spy3).to.have.not.been.called;

      await tick();
      expect(spy).to.be.calledOnce;
      expect(spy.getCall(0).args).to.deep.equal([testDoc]);
      expect(spy2).to.be.calledOnce;
      expect(spy3).to.be.calledOnce;
    });

    it('should not call callback', async () => {
      const spy = sandbox.spy();
      whenDocumentReady(testDoc).then(spy);
      expect(spy).to.have.not.been.called;

      await tick(99);
      expect(spy).to.have.not.been.called;
    });

    it('should wait to call callback until ready', async () => {
      testDoc.readyState = 'loading';
      const callback = sandbox.spy();
      whenDocumentReady(testDoc).then(callback);

      await tick(99);
      expect(callback).to.have.not.been.called;
      expect(countListeners()).to.equal(1);

      // Complete
      testDoc.readyState = 'complete';
      callListeners();

      await tick();
      expect(callback).to.be.calledOnce;
      expect(callback.getCall(0).args).to.deep.equal([testDoc]);
      expect(countListeners()).to.equal(0);
    });
  });

  describe('whenDocumentComplete', () => {
    it('should call callback immediately when complete', async () => {
      testDoc.readyState = 'complete';
      const spy = sandbox.spy();
      const spy2 = sandbox.spy();
      const spy3 = sandbox.spy();

      whenDocumentComplete(testDoc)
        .then(spy)
        .then(spy2);

      whenDocumentComplete(testDoc).then(spy3);

      expect(spy).to.have.not.been.called;
      expect(spy2).to.have.not.been.called;
      expect(spy3).to.have.not.been.called;

      await tick(99);
      expect(spy).to.be.calledOnce;
      expect(spy.getCall(0).args).to.deep.equal([testDoc]);
      expect(spy2).to.be.calledOnce;
      expect(spy3).to.be.calledOnce;
    });

    it('should not call callback', async () => {
      const spy = sandbox.spy();
      whenDocumentComplete(testDoc).then(spy);
      expect(spy).to.have.not.been.called;

      await tick();
      expect(spy).to.have.not.been.called;
    });

    it('should wait to call callback until ready', async () => {
      testDoc.readyState = 'loading';
      const callback = sandbox.spy();
      whenDocumentComplete(testDoc).then(callback);

      await tick();
      expect(callback).to.have.not.been.called;
      expect(countListeners()).to.equal(1);

      // interactive
      testDoc.readyState = 'interactive';
      callListeners();

      await tick();
      expect(callback).to.have.not.been.called;
      expect(countListeners()).to.equal(1);

      // Complete
      testDoc.readyState = 'complete';
      callListeners();

      await tick();
      expect(callback).to.be.calledOnce;
      expect(callback.getCall(0).args).to.deep.equal([testDoc]);
      expect(countListeners()).to.equal(0);
    });
  });
});
