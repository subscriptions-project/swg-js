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

import {FetchResponse, Xhr, assertSuccess, fetchPolyfill} from './xhr';

describes.realWin('test', {}, () => {
  describe('XHR', function () {
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
      },
      {
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
        if (
          eq > -1 &&
          decodeURIComponent(cookie.substring(0, eq).trim()) === name
        ) {
          const value = cookie.substring(eq + 1).trim();
          return decodeURIComponent(value, value);
        }
      }
      return null;
    }

    beforeEach(() => {
      location.href = 'https://acme.com/path';
    });

    for (const test of scenarios) {
      let xhr;
      let mockXhr;
      let xhrCreated;

      // Since if it's the Native fetch, it won't use the XHR object so
      // mocking and testing the request becomes not doable.
      if (test.desc != 'Native') {
        describe('#XHR', () => {
          beforeEach(() => {
            xhr = new Xhr(test.win);
            mockXhr = sandbox.useFakeXMLHttpRequest();
            xhrCreated = new Promise((resolve) => (mockXhr.onCreate = resolve));
          });

          afterEach(() => {
            sandbox.restore();
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

          it('should do `GET` as default method', async () => {
            xhr.fetch('/get?k=v1');
            // expect(server.requests[0].method).to.equal('GET');
            const request = await xhrCreated;
            expect(request.method).to.equal('GET');
          });

          it('should normalize GET method names to uppercase', async () => {
            xhr.fetch('/abc');
            const request = await xhrCreated;
            expect(request.method).to.equal('GET');
          });

          it('should normalize POST method names to uppercase', async () => {
            xhr.fetch('/abc', {
              method: 'post',
              body: JSON.stringify({
                hello: 'world',
              }),
            });
            const request = await xhrCreated;
            expect(request.method).to.equal('POST');
          });
        });
      }

      describe(test.desc, () => {
        beforeEach(() => (xhr = new Xhr(test.win)));

        describe('assertSuccess', () => {
          function createResponseInstance(body, init) {
            if (test.desc !== 'Native' || !('Response' in Window)) {
              init.responseText = body;
              return new FetchResponse(init);
            }
          }
          const mockXhr = {
            status: 200,
            headers: {
              'Content-Type': 'plain/text',
            },
          };

          it('should resolve if success', async () => {
            mockXhr.status = 200;
            const response = await assertSuccess(
              createResponseInstance('', mockXhr)
            );
            expect(response.status).to.equal(200);
          });

          it('should reject if error', async () => {
            mockXhr.status = 500;
            const promise = assertSuccess(createResponseInstance('', mockXhr));
            await expect(promise).to.eventually.throw;
          });

          it('should include response in error', async () => {
            mockXhr.status = 500;
            try {
              await assertSuccess(createResponseInstance('', mockXhr));
            } catch (reason) {
              expect(reason.response).to.exist;
              expect(reason.response.status).to.equal(500);
            }
          });

          it('should not resolve after rejecting promise', async () => {
            mockXhr.status = 500;
            mockXhr.responseText = '{"a": "hello"}';
            mockXhr.headers['Content-Type'] = 'application/json';
            mockXhr.getResponseHeader = () => 'application/json';
            await assertSuccess(createResponseInstance('{"a": 2}', mockXhr))
              .should.not.be.fulfilled;
          });
        });

        it('should do simple JSON fetch', async () => {
          const response = await xhr
            .fetch('http://localhost:31862/get?k=v1')
            .then((res) => res.json());
          expect(response).to.exist;
          expect(response['args']['k']).to.equal('v1');
        });

        it('should redirect fetch', async () => {
          const url =
            'http://localhost:31862/redirect-to?url=' +
            encodeURIComponent('http://localhost:31862/get?k=v2');
          const response = await xhr
            .fetch(url, {ampCors: false})
            .then((res) => res.json());
          expect(response).to.exist;
          expect(response['args']['k']).to.equal('v2');
        });

        it('should fail fetch for 400-error', async () => {
          const url = 'http://localhost:31862/status/404';
          await expect(xhr.fetch(url)).to.be.rejectedWith('HTTP error 404');
        });

        it('should fail fetch for 500-error', async () => {
          const url = 'http://localhost:31862/status/500?CID=cid';
          await expect(xhr.fetch(url)).to.be.rejectedWith('HTTP error 500');
        });

        it('should NOT succeed CORS setting cookies without credentials', async () => {
          const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
          const url =
            'http://localhost:31862/cookies/set?' + cookieName + '=v1';
          const response = await xhr.fetch(url);
          expect(response).to.exist;
          expect(getCookie(self, cookieName)).to.be.null;
        });

        it('should succeed CORS setting cookies with credentials', async () => {
          const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
          const url =
            'http://localhost:31862/cookies/set?' + cookieName + '=v1';
          const response = await xhr.fetch(url, {credentials: 'include'});
          expect(response).to.exist;
          expect(getCookie(self, cookieName)).to.equal('v1');
        });

        it('should ignore CORS setting cookies w/omit credentials', async () => {
          const cookieName = 'TEST_CORS_' + Math.round(Math.random() * 10000);
          const url =
            'http://localhost:31862/cookies/set?' + cookieName + '=v1';
          const response = await xhr.fetch(url, {credentials: 'omit'});
          expect(response).to.exist;
          expect(getCookie(self, cookieName)).to.be.null;
        });

        it('should NOT succeed CORS with invalid credentials', () => {
          expect(() => {
            xhr.fetch('https://acme.org/', {credentials: null});
          }).to.throw(/Only credentials=include|omit support: null/);
        });

        it('should omit request details for privacy', async () => {
          // NOTE THIS IS A BAD PORT ON PURPOSE.
          await expect(
            xhr.fetch('http://localhost:31862/status/500')
          ).to.be.rejectedWith('HTTP error 500');
        });
      });
    }

    for (const test of scenarios) {
      const url = 'http://localhost:31862/post';

      describe(test.desc + ' POST', () => {
        let xhr;

        beforeEach(() => (xhr = new Xhr(test.win)));

        it("should get an echo'd response back", async () => {
          const response = await xhr
            .fetch(url, {
              method: 'POST',
              body: JSON.stringify({
                hello: 'world',
              }),
              headers: {
                'Content-Type': 'application/json;charset=utf-8',
              },
            })
            .then((res) => res.json());
          expect(response.json).to.jsonEqual({
            hello: 'world',
          });
        });
      });
    }

    describe('FetchResponse', () => {
      const TEST_TEXT = 'this is some test text';
      const mockXhr = {
        status: 200,
        responseText: TEST_TEXT,
      };

      it('should provide text', async () => {
        const response = new FetchResponse(mockXhr);
        const result = await response.text();
        expect(result).to.equal(TEST_TEXT);
      });

      it('should provide text only once', async () => {
        const response = new FetchResponse(mockXhr);
        const result = await response.text();
        expect(result).to.equal(TEST_TEXT);
        expect(response.text.bind(response), 'should throw').to.throw(
          Error,
          /Body already used/
        );
      });

      it('should be cloneable and each instance should provide text', async () => {
        const response = new FetchResponse(mockXhr);
        const clone = response.clone();
        const results = await Promise.all([response.text(), clone.text()]);
        expect(results[0]).to.equal(TEST_TEXT);
        expect(results[1]).to.equal(TEST_TEXT);
      });

      it('should not be cloneable if body is already accessed', async () => {
        const response = new FetchResponse(mockXhr);
        await response.text();
        expect(() => response.clone(), 'should throw').to.throw(
          Error,
          /Body already used/
        );
      });
    });
  });
});
