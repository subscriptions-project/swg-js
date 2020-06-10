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

import {Storage} from './storage';

class WebStorageStub {
  getItem(unusedKey) {}
  setItem(unusedKey, unusedValue) {}
  removeItem(unusedKey) {}
}

describes.realWin('Storage', {}, (env) => {
  let win;
  let sessionStorageMock;
  let storage;

  beforeEach(() => {
    win = env.win;
    const sessionStorage = new WebStorageStub();
    sessionStorageMock = sandbox.mock(sessionStorage);
    Object.defineProperty(win, 'sessionStorage', {value: sessionStorage});
    storage = new Storage(win);
  });

  it('should return fresh value from the storage', async () => {
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .returns('one')
      .once();

    await expect(storage.get('a')).to.be.eventually.equal('one');
  });

  it('should return null value if not in the storage', async () => {
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .returns(null)
      .once();

    await expect(storage.get('a')).to.be.eventually.be.null;
  });

  it('should return cached value from the storage', async () => {
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .returns('one')
      .once(); // Only executed once.

    await expect(storage.get('a')).to.eventually.equal('one');
    await expect(storage.get('a')).to.eventually.equal('one');
  });

  it('should return null if storage is not available', async () => {
    Object.defineProperty(win, 'sessionStorage', {value: null});
    sessionStorageMock.expects('getItem').never();
    await expect(storage.get('a')).to.be.eventually.be.null;
  });

  it('should return null value if storage fails', async () => {
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .throws(new Error('intentional'))
      .once();

    await expect(storage.get('a')).to.be.eventually.be.null;
  });

  it('should set a value', async () => {
    sessionStorageMock
      .expects('setItem')
      .withExactArgs('subscribe.google.com:a', 'one')
      .once();

    await expect(storage.set('a', 'one')).to.be.eventually.be.undefined;
  });

  it('should set a value with no storage', async () => {
    sessionStorageMock.expects('getItem').never();
    sessionStorageMock.expects('setItem').never();
    Object.defineProperty(win, 'sessionStorage', {value: null});
    storage.set('a', 'one');

    await expect(storage.get('a')).to.be.eventually.equal('one');
  });

  it('should set a value with failing storage', async () => {
    sessionStorageMock
      .expects('setItem')
      .withExactArgs('subscribe.google.com:a', 'one')
      .throws(new Error('intentional'))
      .once();

    await storage.set('a', 'one');
    await expect(storage.get('a')).to.be.eventually.equal('one');
  });

  it('should remove a value', async () => {
    storage.set('a', 'one');
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .returns(null)
      .once();
    sessionStorageMock
      .expects('removeItem')
      .withExactArgs('subscribe.google.com:a')
      .once();

    await storage.remove('a');
    await expect(storage.get('a')).to.be.eventually.be.null;
  });

  it('should remove a value with no storage', async () => {
    sessionStorageMock.expects('getItem').never();
    sessionStorageMock.expects('removeItem').never();
    Object.defineProperty(win, 'sessionStorage', {value: null});
    storage.set('a', 'one');
    storage.remove('a');

    await expect(storage.get('a')).to.be.eventually.null;
  });

  it('should remove a value with failing storage', async () => {
    sessionStorageMock
      .expects('removeItem')
      .withExactArgs('subscribe.google.com:a')
      .throws(new Error('intentional'))
      .once();
    sessionStorageMock
      .expects('getItem')
      .withExactArgs('subscribe.google.com:a')
      .returns(null)
      .once();
    storage.set('a', 'one');

    await storage.remove('a');
    await expect(storage.get('a')).to.be.eventually.null;
  });
});
