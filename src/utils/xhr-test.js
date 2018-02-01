/**
 * Copyright 2017 The Subscribe with Google Authors. All Rights Reserved.
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

import * as sinon from 'sinon';
import {
  Xhr,
  fetchPolyfill,
  FetchResponse,
  assertSuccess,
} from './xhr';

describe('XHR', function() {
  let sandbox;
  const location = {href: 'https://acme.com/path'};
  const nativeWin = {
    location,
    fetch: self.fetch,
  };

  const polyfillWin = {
    location,
    fetch: fetchPolyfill,
  };

  const scenarios = [
    {
      win: nativeWin,
      desc: 'Native',
    }, {
      win: polyfillWin,
      desc: 'Polyfill',
    },
  ];

  function getCookie(win, name) {
    const cookieString = win.document.cookie;
    if (!cookieString) {
      return null;
    }
    const cookies = cookieString.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      const eq = cookie.indexOf('=');
      if (eq == -1) {
        continue;
      }
      if (decodeURIComponent(cookie.substring(0, eq).trim()) == name) {
        const value = cookie.substring(eq + 1).trim();
        return decodeURIComponent(value, value);
      }
    }
    return null;
  }

  beforeEach(() => {
    sandbox = sinon.sandbox.create();
    location.href = 'https://acme.com/path';
  });

  afterEach(() => {
    sandbox.restore();
  });

  scenarios.forEach(test => {
    let xhr;

    // Since if it's the Native fetch, it won't use the XHR object so
    // mocking and testing the request becomes not doable.
    if (test.desc != 'Native') {

      describe('#XHR', () => {
        beforeEach(() => {
          xhr = new Xhr(test.win);
          sandbox.useFakeXMLHttpRequest();
        });

        it('should allow GET and POST methods', () => {
          const get = xhr.fetch.bind(xhr, '/get?k=v1');
          const post = xhr.fetch.bind(xhr, '/post', {
            method: 'POST',
            body: JSON.stringify({
              hello: 'world',
            }),
          });
          const put = xhr.fetch.bind(xhr, '/put', {
            method: 'PUT',
            body: JSON.stringify({
              hello: 'world',
            }),
          });
          const patch = xhr.fetch.bind(xhr, '/patch', {
            method: 'PATCH',
            body: JSON.stringify({
              hello: 'world',
            }),
          });
          const deleteMethod = xhr.fetch.bind(xhr, '/delete', {
            method: 'DELETE',
            body: JSON.stringify({
              id: 3,
            }),
          });

          expect(get).to.not.throw();
          expect(post).to.not.throw();
          expect(put).to.throw();
          expect(patch).to.throw();
          expect(deleteMethod).to.throw();
        });

        it('should allow FormData as body', () => {
          const formData = new FormData();
          sandbox.stub(JSON, 'stringify');
          formData.append('name', 'John Miller');
          formData.append('age', 56);
          const post = xhr.fetch.bind(xhr, '/post', {
            method: 'POST',
            body: formData,
          });
          expect(post).to.not.throw();
          expect(JSON.stringify.called).to.be.false;
        });

        it('should do `GET` as default method', () => {
          xhr.fetch('/get?k=v1');
          expect(sandbox.server.requests[0].method).to.equal('GET');
        });

        it('should normalize method names to uppercase', () => {
          xhr.fetch('/abc');
          xhr.fetch('/abc', {
            method: 'post',
            body: JSON.stringify({
              hello: 'world',
            }),
          });
          expect(sandbox.server.requests[0].method).to.equal('GET');
          expect(sandbox.server.requests[1].method).to.equal('POST');
        });
      });
    }

    describe(test.desc, () => {
      beforeEach(() => xhr = new Xhr(test.win));

      describe('assertSuccess', () => {
        function createResponseInstance(body, init) {
          if (test.desc == 'Native' && 'Response' in Window) {
            return new Response(body, init);
          } else {
            init.responseText = body;
            return new FetchResponse(init);
          }
        }
        const mockXhr = {
          status: 200,
          headers: {
            'Content-Type': 'plain/text',
          },
          getResponseHeader: () => '',
        };

        it('should resolve if success', () => {
          mockXhr.status = 200;
          return assertSuccess(createResponseInstance('', mockXhr))
              .then(response => {
                expect(response.status).to.equal(200);
              }).should.not.be.rejected;
        });

        it('should reject if error', () => {
          mockXhr.status = 500;
          return assertSuccess(createResponseInstance('', mockXhr))
              .should.be.rejected;
        });

        it('should include response in error', () => {
          mockXhr.status = 500;
          return assertSuccess(createResponseInstance('', mockXhr))
              .catch(error => {
                expect(error.response).to.exist;
                expect(error.response.status).to.equal(500);
              });
        });

        it('should not resolve after rejecting promise', () => {
          mockXhr.status = 500;
          mockXhr.responseText = '{"a": "hello"}';
          mockXhr.headers['Content-Type'] = 'application/json';
          mockXhr.getResponseHeader = () => 'application/json';
          return assertSuccess(createResponseInstance('{"a": 2}', mockXhr))
              .should.not.be.fulfilled;
        });
      });

      it('should do simple JSON fetch', () => {
        return xhr.fetch('http://localhost:31862/get?k=v1')
            .then(res => res.json())
            .then(res => {
              expect(res).to.exist;
              expect(res['args']['k']).to.equal('v1');
            });
      });

      it('should redirect fetch', () => {
        const url = 'http://localhost:31862/redirect-to?url=' + encodeURIComponent(
            'http://localhost:31862/get?k=v2');
        return xhr.fetch(url, {ampCors: false})
            .then(res => res.json())
            .then(res => {
              expect(res).to.exist;
              expect(res['args']['k']).to.equal('v2');
            });
      });

      it('should fail fetch for 400-error', () => {
        const url = 'http://localhost:31862/status/404';
        return xhr.fetch(url).then(() => {
          throw new Error('UNREACHABLE');
        }, error => {
          expect(error.message).to.contain('HTTP error 404');
        });
      });

      it('should fail fetch for 500-error', () => {
        const url = 'http://localhost:31862/status/500?CID=cid';
        return xhr.fetch(url).then(() => {
          throw new Error('UNREACHABLE');
        }, error => {
          expect(error.message).to.contain('HTTP error 500');
        });
      });


      it('should NOT succeed CORS setting cookies without credentials', () => {
        const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
        const url = 'http://localhost:31862/cookies/set?' + cookieName + '=v1';
        return xhr.fetch(url).then(res => {
          expect(res).to.exist;
          expect(getCookie(self, cookieName)).to.be.null;
        });
      });

      it('should succeed CORS setting cookies with credentials', () => {
        const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
        const url = 'http://localhost:31862/cookies/set?' + cookieName + '=v1';
        return xhr.fetch(url, {credentials: 'include'}).then(res => {
          expect(res).to.exist;
          expect(getCookie(self, cookieName)).to.equal('v1');
        });
      });

      it('should ignore CORS setting cookies w/omit credentials', () => {
        const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
        const url = 'http://localhost:31862/cookies/set?' + cookieName + '=v1';
        return xhr.fetch(url, {credentials: 'omit'}).then(res => {
          expect(res).to.exist;
          expect(getCookie(self, cookieName)).to.be.null;
        });
      });

      it('should NOT succeed CORS with invalid credentials', () => {
        expect(() => {
          xhr.fetch('https://acme.org/', {credentials: null});
        }).to.throw(/Only credentials=include|omit support: null/);
      });

      it('should omit request details for privacy', () => {
        // NOTE THIS IS A BAD PORT ON PURPOSE.
        return xhr.fetch('http://localhost:31863/status/500').then(() => {
          throw new Error('UNREACHABLE');
        }, error => {
          const message = error.message;
          expect(message).to.contain('http://localhost:31863');
          expect(message).not.to.contain('status/500');
          expect(message).not.to.contain('CID');
        });
      });
    });
  });

  scenarios.forEach(test => {
    const url = 'http://localhost:31862/post';

    describe(test.desc + ' POST', () => {
      let xhr;

      beforeEach(() => xhr = new Xhr(test.win));

      it('should get an echo\'d response back', () => {
        return xhr.fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            hello: 'world',
          }),
          headers: {
            'Content-Type': 'application/json;charset=utf-8',
          },
        }).then(res => res.json()).then(res => {
          expect(res.json).to.jsonEqual({
            hello: 'world',
          });
        });
      });
    });
  });

  describe('FetchResponse', () => {
    const TEST_TEXT = 'this is some test text';
    const mockXhr = {
      status: 200,
      responseText: TEST_TEXT,
    };

    it('should provide text', () => {
      const response = new FetchResponse(mockXhr);
      return response.text().then(result => {
        expect(result).to.equal(TEST_TEXT);
      });
    });

    it('should provide text only once', () => {
      const response = new FetchResponse(mockXhr);
      return response.text().then(result => {
        expect(result).to.equal(TEST_TEXT);
        expect(response.text.bind(response), 'should throw').to.throw(Error,
            /Body already used/);
      });
    });

    it('should be cloneable and each instance should provide text', () => {
      const response = new FetchResponse(mockXhr);
      const clone = response.clone();
      return Promise.all([
        response.text(),
        clone.text(),
      ]).then(results => {
        expect(results[0]).to.equal(TEST_TEXT);
        expect(results[1]).to.equal(TEST_TEXT);
      });
    });

    it('should not be cloneable if body is already accessed', () => {
      const response = new FetchResponse(mockXhr);
      return response.text()
          .then(() => {
            expect(() => response.clone(), 'should throw').to.throw(
                Error,
                /Body already used/);
          });
    });
  });
});
