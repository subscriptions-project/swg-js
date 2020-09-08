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
  dashToCamelCase,
  endsWith,
  expandTemplate,
  getSwgTransactionId,
  getUuid,
  hash,
} from './string';

describe('dashToCamelCase', () => {
  it('should transform dashes to camel case.', () => {
    expect(dashToCamelCase('foo')).to.equal('foo');
    expect(dashToCamelCase('foo-bar')).to.equal('fooBar');
    expect(dashToCamelCase('foo-bar-baz')).to.equal('fooBarBaz');
    expect(dashToCamelCase('-foo')).to.equal('Foo');
  });
});

describe('endsWith', () => {
  it('should determine whether string ends with.', () => {
    expect(endsWith('a', 'a')).to.be.true;
    expect(endsWith('b', 'a')).to.be.false;
    expect(endsWith('ab', 'a')).to.be.false;
    expect(endsWith('aba', 'a')).to.be.true;
    expect(endsWith('aba', 'aba')).to.be.true;
    expect(endsWith('Xaba', 'aba')).to.be.true;
    expect(endsWith('Xaba', '')).to.be.true;
    expect(endsWith('', 'a')).to.be.false;
    expect(endsWith('aa', 'aaa')).to.be.false;
    expect(endsWith('aa', 'aaaa')).to.be.false;
    expect(endsWith('', '')).to.be.true;
  });
});

describe('expandTemplate', () => {
  const data = {
    'x': 'Test 1',
    'y': 'Test 2',
    'test': 'test value',
    'test2': 'another test value',
    'tox': '${x}',
    'toy': '${y}',
    'toxy': '${x}${y}',
    'totoxy': '${toxy}',
    'loop1': '${loop2}',
    'loop2': '${loop1}',
    'loop': '${loop}',
  };

  function testGetter(key) {
    return data[key] || 'not found';
  }

  it('should replace place holders with values.', () => {
    expect(expandTemplate('${x}', testGetter)).to.equal('Test 1');
    expect(expandTemplate('${y}', testGetter)).to.equal('Test 2');
    expect(expandTemplate('${x} ${y}', testGetter)).to.equal('Test 1 Test 2');
    expect(expandTemplate('a${x}', testGetter)).to.equal('aTest 1');
    expect(expandTemplate('${x}a', testGetter)).to.equal('Test 1a');
    expect(expandTemplate('a${x}a', testGetter)).to.equal('aTest 1a');
    expect(expandTemplate('${unknown}', testGetter)).to.equal('not found');
  });

  it('should handle malformed place holders.', () => {
    expect(expandTemplate('${x', testGetter)).to.equal('${x');
    expect(expandTemplate('${', testGetter)).to.equal('${');
    expect(expandTemplate('$x}', testGetter)).to.equal('$x}');
    expect(expandTemplate('$x', testGetter)).to.equal('$x');
    expect(expandTemplate('{x}', testGetter)).to.equal('{x}');
    expect(expandTemplate('${{x}', testGetter)).to.equal('not found');
  });

  it('should default to one iteration.', () => {
    expect(expandTemplate('${tox}', testGetter)).to.equal('${x}');
    expect(expandTemplate('${toxy}', testGetter)).to.equal('${x}${y}');
  });

  it('should handle multiple iterations when asked to.', () => {
    expect(expandTemplate('${tox}', testGetter, 2)).to.equal('Test 1');
    expect(expandTemplate('${toxy}', testGetter, 2)).to.equal('Test 1Test 2');
    expect(expandTemplate('${totoxy}', testGetter, 2)).to.equal('${x}${y}');
    expect(expandTemplate('${totoxy}', testGetter, 3)).to.equal('Test 1Test 2');
    expect(expandTemplate('${totoxy}', testGetter, 10)).to.equal(
      'Test 1Test 2'
    );
  });

  it('should handle circular expansions without hanging', () => {
    expect(expandTemplate('${loop}', testGetter)).to.equal('${loop}');
    expect(expandTemplate('${loop}', testGetter), 10).to.equal('${loop}');
    expect(expandTemplate('${loop1}', testGetter), 10).to.equal('${loop2}');
  });
});

const allowedChars = '0123456789ABCDEF-'.split('');
const allowChar19 = '89AB'.split('');
/**
 * Returns true if the UUID has a valid format.
 * @param {string} uuid
 */
function isValidUuid(uuid) {
  expect(uuid).to.not.be.undefined;
  expect(uuid.length).to.equal(36);
  for (let i = 0; i < uuid.length; i++) {
    expect(uuid[i]).to.be.oneOf(allowedChars);
  }
  expect(uuid[14]).to.equal('4');
  expect(uuid[19]).to.be.oneOf(allowChar19);

  const uuidArray = uuid.split('-');
  expect(uuidArray.length).to.equal(5);
  expect(uuidArray[0].length).to.equal(8);
  expect(uuidArray[1].length).to.equal(4);
  expect(uuidArray[2].length).to.equal(4);
  expect(uuidArray[3].length).to.equal(4);
  expect(uuidArray[4].length).to.equal(12);
  //98C2426F-4138-4F14-9694-7E86FD958EBF
}

describe('uuid', () => {
  it('should generate a set of valid unique RFC 4122 V4 uuids', () => {
    // Flakiness warning: could randomly generate the same one every now and
    // then.
    const uuids = {};
    for (let i = 0; i < 100; i++) {
      const uuid = getUuid();
      isValidUuid(uuid);
      expect(uuids[uuid]).to.be.undefined;
      uuids[uuid] = 1;
    }
  });
});

describe('swgTransactionId', () => {
  it('should generate a valid SwG transaction ID on the form uuid.swg', () => {
    // Flakiness warning: could randomly generate the same one every now and
    // then.
    const swgTransactionIds = {};
    for (let i = 0; i < 100; i++) {
      const swgTransactionId = getSwgTransactionId();
      const deconstructedId = swgTransactionId.split('.');
      expect(deconstructedId.length).to.equal(2);
      isValidUuid(deconstructedId[0]);
      expect(deconstructedId[1]).to.equal('swg');
      expect(swgTransactionIds[swgTransactionId]).to.be.undefined;
      swgTransactionIds[swgTransactionId] = 1;
    }
  });
});

describe('hash', async () => {
  it("should use a stable hashing algorithm so metering doesn't break", async () => {
    const expectedValue =
      '8b16b8443e811a5238616fa150eeae441444d5a7ffd7ff59d2f5ebcc455af1c545b3e96af77e12298d756848ac3d105360492db81e2723512bb7d2c6b0b7aedd';
    expect(await hash('string1')).to.equal(expectedValue);
  });

  it('should create standard length hashes', async () => {
    expect(await hash('a').length).to.equal(
      await hash('aMuchLongerStringToEncode').length
    );
  });

  it('should create hexadecimal hashes', async () => {
    const hasOnlyHexChars = RegExp(/[0-9a-f]+/, 'g');
    expect(hasOnlyHexChars.test(await hash('string1'))).to.be.true;
  });

  it('should create duplicatable hashes', async () => {
    const STRING = 'string1';
    expect(await hash(STRING)).to.equal(await hash(STRING));
  });

  it('should create unique hashes', async () => {
    const hash1 = await hash('string1');
    const hash2 = await hash('string2');
    expect(hash1).to.not.equal(hash2);
  });
});
