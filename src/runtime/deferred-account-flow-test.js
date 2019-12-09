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

import {ActivityPort} from '../components/activities';
import {AnalyticsEvent} from '../proto/api_messages';
import {ConfiguredRuntime} from './runtime';
import {DeferredAccountCreationResponse} from '../api/deferred-account-creation';
import {DeferredAccountFlow} from './deferred-account-flow';
import {Entitlement, Entitlements} from '../api/entitlements';
import {PageConfig} from '../model/page-config';
import {PayCompleteFlow} from './pay-flow';

const EMPTY_ID_TOK =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJJRF9UT0sifQ.SIG';

describes.realWin('DeferredAccountFlow', {}, env => {
  const ack = function() {};
  let win;
  let pageConfig;
  let runtime;
  let activitiesMock;
  let dialogManagerMock;
  let callbacksMock;
  let entitlementsManagerMock;
  let ents;
  let port;
  let resultResolver;
  let flow;
  let eventManagerMock;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1:product1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    activitiesMock = sandbox.mock(runtime.activities());
    dialogManagerMock = sandbox.mock(runtime.dialogManager());
    callbacksMock = sandbox.mock(runtime.callbacks());
    entitlementsManagerMock = sandbox.mock(runtime.entitlementsManager());
    eventManagerMock = sandbox.mock(runtime.eventManager());

    ents = new Entitlements(
      'subscribe.google.com',
      'RaW',
      [
        new Entitlement('source2', ['product2', 'product3'], 'token2'),
        new Entitlement('google', ['product1', 'product2'], 'G_SUB_TOKEN'),
      ],
      'pub1:product1',
      ack
    );
    flow = new DeferredAccountFlow(runtime, {
      entitlements: ents,
    });

    port = new ActivityPort();
    port.onResizeRequest = () => {};
    port.whenReady = () => Promise.resolve();
    resultResolver = null;
    const resultPromise = new Promise(resolve => {
      resultResolver = resolve;
    });
    port.acceptResult = () => resultPromise;
  });

  afterEach(() => {
    activitiesMock.verify();
    dialogManagerMock.verify();
    callbacksMock.verify();
    entitlementsManagerMock.verify();
    eventManagerMock.verify();
  });

  it('should initialize options', () => {
    expect(flow.options_.entitlements).to.equal(ents);
    expect(flow.options_.consent).to.be.true;
  });

  it('should override consent option to false', () => {
    flow = new DeferredAccountFlow(runtime, {
      entitlements: ents,
      consent: false,
    });
    expect(flow.options_.consent).to.be.false;
    expect(flow.options_.entitlements).to.equal(ents);
  });

  it('should disallow no entitlement', () => {
    flow = new DeferredAccountFlow(runtime);
    expect(() => {
      flow.start();
    }).to.throw(/\"google\" source/);
  });

  it('should disallow empty entitlement', () => {
    ents = new Entitlements(
      'subscribe.google.com',
      'RaW',
      [],
      'pub1:product1',
      ack
    );
    flow = new DeferredAccountFlow(runtime, {
      entitlements: ents,
    });
    expect(() => {
      flow.start();
    }).to.throw(/\"google\" source/);
  });

  it('should require "google" entitlement', () => {
    ents = new Entitlements(
      'subscribe.google.com',
      'RaW',
      [new Entitlement('other', ['product1', 'product2'], 'SUB_TOKEN')],
      'pub1:product1',
      ack
    );
    flow = new DeferredAccountFlow(runtime, {
      entitlements: ents,
    });
    expect(() => {
      flow.start();
    }).to.throw(/\"google\" source/);
  });

  it('should start flow', () => {
    callbacksMock
      .expects('triggerFlowStarted')
      .withExactArgs('completeDeferredAccountCreation')
      .once();
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock
      .expects('openIframe')
      .withExactArgs(
        sandbox.match(arg => arg.tagName == 'IFRAME'),
        '$frontend$/swg/_/ui/v1/recoveriframe?_=_',
        {
          _client: 'SwG $internalRuntimeVersion$',
          publicationId: 'pub1',
          productId: 'pub1:product1',
          entitlements: 'RaW',
          consent: true,
        }
      )
      .returns(Promise.resolve(port));
    flow.start();
    return flow.openPromise_;
  });

  it('should handle cancel', async () => {
    callbacksMock
      .expects('triggerFlowCanceled')
      .withExactArgs('completeDeferredAccountCreation')
      .once();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    resultResolver(Promise.reject(new DOMException('cancel', 'AbortError')));
    dialogManagerMock.expects('completeView').once();
    await expect(flow.start()).to.be.rejectedWith(/cancel/);
  });

  it('should handle failure', async () => {
    callbacksMock.expects('triggerFlowCanceled').never();
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    resultResolver(Promise.reject(new Error('broken')));
    dialogManagerMock.expects('completeView').once();
    await expect(flow.start()).to.be.rejectedWith(/broken/);
  });

  it('should continue with confirmation flow', async () => {
    const outputEnts = new Entitlements(
      'subscribe.google.com',
      'RaW',
      [new Entitlement('google', ['product1', 'product2'], 'G_SUB_TOKEN')],
      'pub1:product1',
      ack
    );
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    entitlementsManagerMock.expects('blockNextNotification').once();
    entitlementsManagerMock
      .expects('parseEntitlements')
      .withExactArgs({signedEntitlements: 'OUTPUT_JWT'})
      .returns(outputEnts)
      .once();
    const confirmStartStub = sandbox.stub(PayCompleteFlow.prototype, 'start');
    const confirmCompleteStub = sandbox
      .stub(PayCompleteFlow.prototype, 'complete')
      .callsFake(() => Promise.resolve());
    resultResolver({
      data: {
        entitlements: 'OUTPUT_JWT',
        idToken: EMPTY_ID_TOK,
        purchaseData: {
          data: 'PURCHASE_DATA',
          signature: 'SIG(PURCHASE_DATA)',
        },
      },
    });

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_NEW_DEFERRED_ACCOUNT, true)
      .once();

    const response = await flow.start();
    expect(response.entitlements).to.equal(outputEnts);
    expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(response.userData.id).to.equal('ID_TOK');
    expect(response.purchaseData.raw).to.equal('PURCHASE_DATA');
    expect(response.purchaseData.signature).to.equal('SIG(PURCHASE_DATA)');
    expect(response.purchaseDataList).to.have.length(1);
    expect(response.purchaseDataList[0].raw).to.equal('PURCHASE_DATA');
    expect(response.purchaseDataList[0].signature).to.equal(
      'SIG(PURCHASE_DATA)'
    );

    expect(confirmStartStub).to.be.calledOnce;
    const confirmRequest = confirmStartStub.args[0][0];
    expect(confirmRequest.entitlements).to.equal(response.entitlements);
    expect(confirmRequest.userData).to.equal(response.userData);
    expect(confirmRequest.purchaseData).to.equal(response.purchaseDataList[0]);

    expect(confirmCompleteStub).to.not.be.called;
    const completePromise = response.complete();
    expect(confirmCompleteStub).to.be.calledOnce;
    await completePromise;
  });

  it('should accept purchase data list', async () => {
    const outputEnts = new Entitlements(
      'subscribe.google.com',
      'RaW',
      [new Entitlement('google', ['product1', 'product2'], 'G_SUB_TOKEN')],
      'pub1:product1',
      ack
    );
    activitiesMock.expects('openIframe').returns(Promise.resolve(port));
    entitlementsManagerMock.expects('blockNextNotification').once();
    entitlementsManagerMock
      .expects('parseEntitlements')
      .withExactArgs({signedEntitlements: 'OUTPUT_JWT'})
      .returns(outputEnts)
      .once();
    const confirmStartStub = sandbox.stub(PayCompleteFlow.prototype, 'start');
    const confirmCompleteStub = sandbox
      .stub(PayCompleteFlow.prototype, 'complete')
      .callsFake(() => Promise.resolve());
    resultResolver({
      data: {
        entitlements: 'OUTPUT_JWT',
        idToken: EMPTY_ID_TOK,
        purchaseDataList: [
          {
            data: 'PURCHASE_DATA1',
            signature: 'SIG(PURCHASE_DATA1)',
          },
          {
            data: 'PURCHASE_DATA2',
            signature: 'SIG(PURCHASE_DATA2)',
          },
        ],
      },
    });

    eventManagerMock
      .expects('logSwgEvent')
      .withExactArgs(AnalyticsEvent.ACTION_NEW_DEFERRED_ACCOUNT, true)
      .once();

    const response = await flow.start();
    expect(response.entitlements).to.equal(outputEnts);
    expect(response.userData.idToken).to.equal(EMPTY_ID_TOK);
    expect(response.userData.id).to.equal('ID_TOK');
    expect(response.purchaseData.raw).to.equal('PURCHASE_DATA1');
    expect(response.purchaseData.signature).to.equal('SIG(PURCHASE_DATA1)');
    expect(response.purchaseDataList).to.have.length(2);
    expect(response.purchaseDataList[0].raw).to.equal('PURCHASE_DATA1');
    expect(response.purchaseDataList[0].signature).to.equal(
      'SIG(PURCHASE_DATA1)'
    );
    expect(response.purchaseDataList[1].raw).to.equal('PURCHASE_DATA2');
    expect(response.purchaseDataList[1].signature).to.equal(
      'SIG(PURCHASE_DATA2)'
    );

    expect(confirmStartStub).to.be.calledOnce;
    const confirmRequest = confirmStartStub.args[0][0];
    expect(confirmRequest.entitlements).to.equal(response.entitlements);
    expect(confirmRequest.userData).to.equal(response.userData);
    expect(confirmRequest.purchaseData).to.equal(response.purchaseDataList[0]);

    expect(confirmCompleteStub).to.not.be.called;
    const completePromise = response.complete();
    expect(confirmCompleteStub).to.be.calledOnce;
    await completePromise;
  });
});
