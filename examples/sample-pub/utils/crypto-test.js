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

import * as crypto from './crypto';

describe('crypto', () => {
  it('should convert a string to base64', () => {
    expect(crypto.toBase64('test')).to.equal('dGVzdA==');
    expect(crypto.toBase64('a@somedomain.com')).to.equal(
      'YUBzb21lZG9tYWluLmNvbQ=='
    );
  });

  it('should convert from base64 to string', () => {
    expect(crypto.fromBase64('dGVzdA==')).to.equal('test');
    expect(crypto.fromBase64('YUBzb21lZG9tYWluLmNvbQ==')).to.equal(
      'a@somedomain.com'
    );
  });

  it('should encrypt an object', () => {
    expect(crypto.encrypt({a: 1, b: 2})).to.equal('encrypted({"a":1,"b":2})');
    expect(crypto.encrypt({})).to.equal('encrypted({})');
    expect(crypto.encrypt('t')).to.equal('encrypted("t")');
  });

  it('should decrypt an encrypted object', () => {
    const decryptedObject = crypto.decrypt('encrypted({"a":1,"b":2})');
    expect(decryptedObject).to.deep.equal({a: 1, b: 2});

    const decryptedObject2 = crypto.decrypt('encrypted({})');
    expect(decryptedObject2).to.deep.equal({});

    const decryptedObject3 = crypto.decrypt('encrypted("t")');
    expect(decryptedObject3).to.equal('t');
  });
});
