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

import {getPropertyFromJsonString, tryParseJson} from './json';

describe('json', () => {
  describe('tryParseJson', () => {
    it('should return object for valid json', () => {
      const json = '{"key": "value"}';
      const result = tryParseJson(json);
      expect(result.key).to.equal('value');
    });

    it('should not throw and return undefined for invalid json', () => {
      const json = '{"key": "val';
      expect(tryParseJson.bind(null, json)).to.not.throw;
      const result = tryParseJson(json);
      expect(result).to.be.undefined;
    });

    it('should call onFailed for invalid and not call for valid json', () => {
      let error;
      let onFailedCalled = false;

      function onFailure(e) {
        error = e;
        onFailedCalled = true;
      }

      const validJson = '{"key": "value"}';
      tryParseJson(validJson, onFailure);
      expect(error).to.not.exist;
      expect(onFailedCalled).to.be.false;

      const invalidJson = '{"key": "val';
      tryParseJson(invalidJson, onFailure);
      expect(error).to.exist;
      expect(onFailedCalled).to.be.true;
    });
  });

  describe('getPropertyFromJsonString', () => {
    it('gets value', () => {
      const value = getPropertyFromJsonString('{"x":1}', 'x');
      expect(value).to.equal(1);
    });

    it('returns null if value was not found', () => {
      const value = getPropertyFromJsonString('{}', 'x');
      expect(value).to.equal(null);
    });
  });
});
