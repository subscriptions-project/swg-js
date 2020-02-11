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

import {AnalyticsContext} from '../proto/api_messages';
import {
  addQueryParam,
  getHostUrl,
  parseQueryString,
  parseUrl,
  serializeProtoMessageForUrl,
  serializeQueryString,
} from './url';

describe('serializeQueryString', () => {
  it('should return empty string for empty params', () => {
    expect(serializeQueryString({})).to.equal('');
    expect(
      serializeQueryString({
        nullValue: null,
        undefValue: undefined,
      })
    ).to.equal('');
  });
  it('should serialize a single value', () => {
    expect(serializeQueryString({a: 'A'})).to.equal('a=A');
  });
  it('should serialize multiple values', () => {
    expect(serializeQueryString({a: 'A', b: 'B'})).to.equal('a=A&b=B');
  });
  it('should coerce to string', () => {
    expect(serializeQueryString({a: 1, b: true})).to.equal('a=1&b=true');
  });
  it('should encode values and keys', () => {
    expect(serializeQueryString({'a+b': 'A+B'})).to.equal('a%2Bb=A%2BB');
  });
  it('should serialize multiple valued parameters', () => {
    expect(serializeQueryString({a: [1, 2, 3], b: true})).to.equal(
      'a=1&a=2&a=3&b=true'
    );
  });
});

describe('parseUrl', () => {
  const currentPort = location.port;

  function compareParse(url, result) {
    // Using JSON string comparison because Chai's deeply equal
    // errors are impossible to debug.
    const parsed = JSON.stringify(parseUrl(url));
    const expected = JSON.stringify(result);
    expect(parsed).to.equal(expected);
  }

  it('should parse correctly', () => {
    compareParse('https://foo.com/abc?123#foo', {
      href: 'https://foo.com/abc?123#foo',
      protocol: 'https:',
      host: 'foo.com',
      hostname: 'foo.com',
      port: '',
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'https://foo.com',
    });
  });
  it('caches results', () => {
    const url = 'https://foo.com:123/abc?123#foo';
    parseUrl(url);
    const a1 = parseUrl(url);
    const a2 = parseUrl(url);
    expect(a1).to.equal(a2);
  });
  it('should handle ports', () => {
    compareParse('https://foo.com:123/abc?123#foo', {
      href: 'https://foo.com:123/abc?123#foo',
      protocol: 'https:',
      host: 'foo.com:123',
      hostname: 'foo.com',
      port: '123',
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'https://foo.com:123',
    });
  });
  it('should omit HTTP default port', () => {
    compareParse('http://foo.com:80/abc?123#foo', {
      href: 'http://foo.com/abc?123#foo',
      protocol: 'http:',
      host: 'foo.com',
      hostname: 'foo.com',
      port: '',
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'http://foo.com',
    });
  });
  it('should omit HTTPS default port', () => {
    compareParse('https://foo.com:443/abc?123#foo', {
      href: 'https://foo.com/abc?123#foo',
      protocol: 'https:',
      host: 'foo.com',
      hostname: 'foo.com',
      port: '',
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'https://foo.com',
    });
  });
  it('should support http', () => {
    compareParse('http://foo.com:123/abc?123#foo', {
      href: 'http://foo.com:123/abc?123#foo',
      protocol: 'http:',
      host: 'foo.com:123',
      hostname: 'foo.com',
      port: '123',
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'http://foo.com:123',
    });
  });
  it('should resolve relative urls', () => {
    compareParse('./abc?123#foo', {
      href: 'http://localhost:' + currentPort + '/abc?123#foo',
      protocol: 'http:',
      host: 'localhost:' + currentPort,
      hostname: 'localhost',
      port: currentPort,
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'http://localhost:' + currentPort,
    });
  });
  it('should resolve path relative urls', () => {
    compareParse('/abc?123#foo', {
      href: 'http://localhost:' + currentPort + '/abc?123#foo',
      protocol: 'http:',
      host: 'localhost:' + currentPort,
      hostname: 'localhost',
      port: currentPort,
      pathname: '/abc',
      search: '?123',
      hash: '#foo',
      origin: 'http://localhost:' + currentPort,
    });
  });
  it('should handle URLs with just the domain', () => {
    compareParse('http://foo.com:123', {
      href: 'http://foo.com:123/',
      protocol: 'http:',
      host: 'foo.com:123',
      hostname: 'foo.com',
      port: '123',
      pathname: '/',
      search: '',
      hash: '',
      origin: 'http://foo.com:123',
    });
  });
  it('should parse origin https://twitter.com/path#abc', () => {
    expect(parseUrl('https://twitter.com/path#abc').origin).to.equal(
      'https://twitter.com'
    );
  });

  it('should parse origin data:12345', () => {
    expect(parseUrl('data:12345').origin).to.equal('data:12345');
  });

  it('should parse URL query string', () => {
    const url = '?test=1&name=new&product=something';
    const parsedQueryObject = parseQueryString(url);
    expect(parsedQueryObject.test).to.equal('1');
    expect(parsedQueryObject.name).to.equal('new');
    expect(parsedQueryObject.product).to.equal('something');
  });

  it('should parse URL query string as fragment', () => {
    const url = '#test=1&name=new&product=something';
    const parsedQueryObject = parseQueryString(url);
    expect(parsedQueryObject.test).to.equal('1');
    expect(parsedQueryObject.name).to.equal('new');
    expect(parsedQueryObject.product).to.equal('something');
  });

  it('should parse URL query string as clear string', () => {
    const url = 'test=1&name=new&product=something';
    const parsedQueryObject = parseQueryString(url);
    expect(parsedQueryObject.test).to.equal('1');
    expect(parsedQueryObject.name).to.equal('new');
    expect(parsedQueryObject.product).to.equal('something');
  });

  it('should parse URL with no query params', () => {
    expect(parseQueryString('?')).to.be.empty;
    expect(parseQueryString('#')).to.be.empty;
    expect(parseQueryString('')).to.be.empty;
  });

  it('should strip fragment for host url', () => {
    expect(getHostUrl('https://example.com/abc?a=1#frag')).to.equal(
      'https://example.com/abc?a=1'
    );
    expect(getHostUrl('https://example.com/abc?a=1')).to.equal(
      'https://example.com/abc?a=1'
    );
    expect(getHostUrl('https://example.com/abc')).to.equal(
      'https://example.com/abc'
    );
    expect(getHostUrl('https://example.com/')).to.equal('https://example.com/');
  });
});

describe('addQueryParam', () => {
  it('should add on a simple url', () => {
    expect(addQueryParam('https://example.org/file', 'a', 'b')).to.equal(
      'https://example.org/file?a=b'
    );
    expect(addQueryParam('https://example.org/', 'a', 'b')).to.equal(
      'https://example.org/?a=b'
    );
    expect(addQueryParam('https://example.org', 'a', 'b')).to.equal(
      'https://example.org?a=b'
    );
    expect(addQueryParam('/file', 'a', 'b')).to.equal('/file?a=b');
    expect(addQueryParam('file', 'a', 'b')).to.equal('file?a=b');
  });

  it('should add on a empty url', () => {
    expect(addQueryParam('', 'a', 'b')).to.equal('?a=b');
  });

  it('should add with existing query', () => {
    expect(addQueryParam('file?', 'a', 'b')).to.equal('file?a=b');
    expect(addQueryParam('file?d=e', 'a', 'b')).to.equal('file?d=e&a=b');
  });

  it('should add with existing fragment', () => {
    expect(addQueryParam('file#', 'a', 'b')).to.equal('file?a=b#');
    expect(addQueryParam('file#f', 'a', 'b')).to.equal('file?a=b#f');
    expect(addQueryParam('file?#f', 'a', 'b')).to.equal('file?a=b#f');
    expect(addQueryParam('file?d=e#f', 'a', 'b')).to.equal('file?d=e&a=b#f');
  });
});

describe('serializeProtoMessageForUrl', () => {
  it('should serialize message', () => {
    const inputArray = [
      null,
      'embed',
      'tx',
      'refer',
      'utmS',
      'utmC',
      'utmM',
      'sku',
      true,
      [],
      'version',
      'baseUrl',
    ];
    const inputContext = new AnalyticsContext(inputArray);
    const outputStr = serializeProtoMessageForUrl(inputContext);
    const outputArr = JSON.parse(outputStr);
    // serialize removed the first element, add it back
    outputArr.unshift(null);
    const outputContext = new AnalyticsContext(outputArr);

    expect(outputArr).to.deep.equal(inputArray);

    expect(outputContext).to.deep.equal(inputContext);

    // reformat input array to the way we expect it to look after serialize
    inputArray.shift();
    const expectedStr = JSON.stringify(inputArray);
    expect(expectedStr).to.equal(outputStr);
  });

  it('should serialize message with experiments in array', () => {
    const inputArray = [
      null,
      'embed',
      'tx',
      'refer',
      'utmS',
      'utmC',
      'utmM',
      'sku',
      true,
      ['exp1', 'exp2'],
      'version',
      'baseUrl',
    ];
    const inputContext = new AnalyticsContext(inputArray);
    const outputStr = serializeProtoMessageForUrl(inputContext);
    const outputArr = JSON.parse(outputStr);
    // serialize removed the first element, add it back
    outputArr.unshift(null);
    const outputContext = new AnalyticsContext(outputArr);

    expect(outputArr).to.deep.equal(inputArray);

    expect(outputContext).to.deep.equal(inputContext);

    // reformat input array to the way we expect it to look after serialize
    inputArray.shift();
    const expectedStr = JSON.stringify(inputArray);
    expect(expectedStr).to.equal(outputStr);

    const inputLabels = inputContext.getLabelList();
    expect(inputLabels[0]).to.equal('exp1');
    expect(inputLabels[1]).to.equal('exp2');

    const outputLabels = outputContext.getLabelList();
    expect(outputLabels[0]).to.equal('exp1');
    expect(outputLabels[1]).to.equal('exp2');
  });
});
