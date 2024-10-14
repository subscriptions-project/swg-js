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

import {PageConfig} from '../model/page-config';
import {Storage} from './storage';

class WebStorageStub {
  getItem(unusedKey) {}
  setItem(unusedKey, unusedValue) {}
  removeItem(unusedKey) {}
}

describes.realWin('Storage', (env) => {
  let win;
  let sessionStorageMock;
  let localStorageMock;
  let storage;
  let pageConfig;
  const productId = 'pubId:label1';

  beforeEach(() => {
    win = env.win;
    const sessionStorage = new WebStorageStub();
    sessionStorageMock = sandbox.mock(sessionStorage);
    Object.defineProperty(win, 'sessionStorage', {value: sessionStorage});
    const localStorage = new WebStorageStub();
    localStorageMock = sandbox.mock(localStorage);
    Object.defineProperty(win, 'localStorage', {value: localStorage});
    pageConfig = new PageConfig(productId);

    storage = new Storage(win, pageConfig);
  });

  describe('Session storage', () => {
    beforeEach(() => {
      localStorageMock.expects('getItem').never();
      localStorageMock.expects('setItem').never();
      localStorageMock.expects('removeItem').never();
    });

    afterEach(() => {
      localStorageMock.verify();
      sessionStorageMock.verify();
    });

    describe('if not available', () => {
      it('get should return null', async () => {
        Object.defineProperty(win, 'sessionStorage', {value: null});
        sessionStorageMock.expects('getItem').never();
        expect(await storage.get('baseKey')).to.be.null;
      });

      it('set should store the value in the instance variable', async () => {
        sessionStorageMock.expects('getItem').never();
        sessionStorageMock.expects('setItem').never();
        Object.defineProperty(win, 'sessionStorage', {value: null});
        storage.set('baseKey', 'one');

        expect(await storage.get('baseKey')).to.equal('one');
      });

      it('remove should remove the value from the instance variable', async () => {
        sessionStorageMock.expects('getItem').never();
        sessionStorageMock.expects('removeItem').never();
        Object.defineProperty(win, 'sessionStorage', {value: null});
        storage.set('baseKey', 'one');
        storage.remove('baseKey');

        expect(await storage.get('baseKey')).to.be.null;
      });
    });

    describe('no value in new key', () => {
      beforeEach(() => {
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey:pubId')
          .returns(null)
          .once();
      });

      it('should return fresh value from the storage', async () => {
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns('one')
          .once();

        expect(await storage.get('baseKey')).to.equal('one');
      });

      it('should return null value if not in the storage', async () => {
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();

        expect(await storage.get('baseKey')).to.be.null;
      });

      it('should return cached value from the storage', async () => {
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns('one')
          .once(); // Only executed once.

        expect(await storage.get('baseKey')).to.equal('one');
        expect(await storage.get('baseKey')).to.equal('one');
      });

      it('should set a value', async () => {
        sessionStorageMock
          .expects('setItem')
          .withExactArgs('subscribe.google.com:baseKey', 'one')
          .once();
        storage.set('baseKey', 'one');

        expect(await storage.get('baseKey')).to.equal('one');
      });

      it('should set a value with failing storage', async () => {
        sessionStorageMock
          .expects('setItem')
          .withExactArgs('subscribe.google.com:baseKey', 'one')
          .throws(new Error('intentional'))
          .once();
        storage.set('baseKey', 'one');

        expect(await storage.get('baseKey')).to.equal('one');
      });

      it('should remove a value', async () => {
        storage.set('baseKey', 'one');
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();
        sessionStorageMock
          .expects('removeItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .once();
        storage.remove('baseKey');

        expect(await storage.get('baseKey')).to.be.null;
      });

      it('should return null value if storage fails', async () => {
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .throws(new Error('intentional'))
          .once();

        expect(await storage.get('baseKey')).to.be.null;
      });

      it('should remove a value with failing storage', async () => {
        sessionStorageMock
          .expects('removeItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .throws(new Error('intentional'))
          .once();
        sessionStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();
        storage.set('baseKey', 'one');
        storage.remove('baseKey');

        expect(await storage.get('baseKey')).to.be.null;
      });
    });
  });

  describe('Local storage', () => {
    beforeEach(() => {
      sessionStorageMock.expects('getItem').never();
      sessionStorageMock.expects('setItem').never();
      sessionStorageMock.expects('removeItem').never();
    });

    afterEach(() => {
      sessionStorageMock.verify();
      localStorageMock.verify();
    });

    describe('if not available', () => {
      it('get should return null', async () => {
        Object.defineProperty(win, 'localStorage', {value: null});
        localStorageMock.expects('getItem').never();
        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });

      it('set should store the value in the instance variable', async () => {
        localStorageMock.expects('getItem').never();
        localStorageMock.expects('setItem').never();
        Object.defineProperty(win, 'localStorage', {value: null});
        storage.set('baseKey', 'one', /* useLocalStorage */ true);

        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
      });

      it('remove should remove the value from the instance variable', async () => {
        localStorageMock.expects('getItem').never();
        localStorageMock.expects('removeItem').never();
        Object.defineProperty(win, 'localStorage', {value: null});
        storage.set('baseKey', 'one', /* useLocalStorage */ true);
        storage.remove('baseKey', /* useLocalStorage */ true);

        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });
    });

    describe('no value in new key', () => {
      beforeEach(() => {
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey:pubId')
          .returns(null)
          .once();
      });

      it('should return fresh value from the storage', async () => {
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns('one')
          .once();

        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
      });

      it('should return null value if not in the storage', async () => {
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();

        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });

      it('should return cached value from the storage', async () => {
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns('one')
          .once(); // Only executed once.

        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
      });

      it('should return null value if storage fails', async () => {
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .throws(new Error('intentional'))
          .once();

        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });

      it('should set a value', async () => {
        localStorageMock
          .expects('setItem')
          .withExactArgs('subscribe.google.com:baseKey', 'one')
          .once();
        storage.set('baseKey', 'one', /* useLocalStorage */ true);

        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
      });

      it('should set a value with failing storage', async () => {
        localStorageMock
          .expects('setItem')
          .withExactArgs('subscribe.google.com:baseKey', 'one')
          .throws(new Error('intentional'))
          .once();
        storage.set('baseKey', 'one', /* useLocalStorage */ true);

        expect(
          await storage.get('baseKey', /* useLocalStorage */ true)
        ).to.equal('one');
      });

      it('should remove a value', async () => {
        storage.set('baseKey', 'one', /* useLocalStorage */ true);
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();
        localStorageMock
          .expects('removeItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .once();
        storage.remove('baseKey', /* useLocalStorage */ true);

        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });

      it('should remove a value with failing storage', async () => {
        localStorageMock
          .expects('removeItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .throws(new Error('intentional'))
          .once();
        localStorageMock
          .expects('getItem')
          .withExactArgs('subscribe.google.com:baseKey')
          .returns(null)
          .once();
        storage.set('baseKey', 'one', /* useLocalStorage */ true);
        storage.remove('baseKey', /* useLocalStorage */ true);

        expect(await storage.get('baseKey', /* useLocalStorage */ true)).to.be
          .null;
      });
    });
  });
});
