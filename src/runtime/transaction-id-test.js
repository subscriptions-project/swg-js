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

import {TransactionId} from './transaction-id';
import {PageConfig} from '../model/page-config';
import {ConfiguredRuntime} from './runtime';
import * as Uuid from '../../third_party/random_uuid/uuid-swg';

describes.realWin('TransactionId', {}, env => {

  let storageMock;
  let transactionId;
  let pageConfig;
  let runtime;
  let win;

  beforeEach(() => {
    win = env.win;
    pageConfig = new PageConfig('pub1');
    runtime = new ConfiguredRuntime(win, pageConfig);
    storageMock = sandbox.mock(runtime.storage());
  });

  afterEach(() => {
    storageMock.verify();
    sandbox.reset();
  });

  it('should generate new transaction id first time', () => {
    transactionId = new TransactionId(runtime);
    storageMock.expects('get')
        .withExactArgs('transaction_id')
        .once().returns(Promise.resolve(null));
    sandbox.stub(Uuid, 'uuidFast', () => {
      return 'google-transaction-0';
    });
    storageMock.expects('set')
        .withExactArgs('transaction_id', 'google-transaction-0')
        .once();
    return transactionId.get().then(id => {
      expect(id).to.equal('google-transaction-0');
    });
  });

  it('should not generate new transaction id if already available', () => {
    transactionId = new TransactionId(runtime);
    storageMock.expects('get')
        .withExactArgs('transaction_id')
        .once().returns(Promise.resolve(null));
    sandbox.stub(Uuid, 'uuidFast', () => {
      return 'google-transaction-0';
    });
    return transactionId.get().then(id => {
      expect(id).to.equal('google-transaction-0');
      storageMock.expects('get')
          .withExactArgs('transaction_id')
          .once().returns(Promise.resolve('google-transaction-0'));
      return transactionId.get();
    }).then(idPrime => {
      expect(idPrime).to.equal('google-transaction-0');
    });
  });

  it('should reset transaction id', () => {
    transactionId = new TransactionId(runtime);
    storageMock.expects('get')
        .withExactArgs('transaction_id')
        .once().returns(Promise.resolve('google-transaction-0'));
    storageMock.expects('remove')
        .withExactArgs('transaction_id')
        .once().returns(Promise.resolve());
    sandbox.stub(Uuid, 'uuidFast', () => {
      return 'google-transaction-1';
    });
    return transactionId.get().then(id => {
      expect(id).to.equal('google-transaction-0');
      storageMock.expects('get')
          .withExactArgs('transaction_id')
          .once().returns(Promise.resolve(null));
      return transactionId.reset();
    }).then(() => {
      storageMock.expects('set')
          .withExactArgs('transaction_id', 'google-transaction-1')
          .once();
      return transactionId.get();
    }).then(idPrime => {
      expect(idPrime).to.equal('google-transaction-1');
    });
  });
});
