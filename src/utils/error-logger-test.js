/**
 * Copyright 2020 The Subscribe with Google Authors. All Rights Reserved.
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

import {ErrorLogger} from './error-logger';

describe('error logger', () => {
  let log;

  beforeEach(function() {
    log = new ErrorLogger();
  });

  describe('createError', () => {
    it('reuses errors when possible', () => {
      let error = new Error('test');

      let createdError = log.createError(error);
      expect(createdError).to.equal(error);
      expect(error.message).to.equal('test');

      createdError = log.createError('should fail', 'XYZ', error);
      expect(createdError).to.equal(error);
      expect(error.message).to.equal('should fail XYZ: test');

      try {
        // This is an intentionally bad query selector
        document.body.querySelector('#');
      } catch (e) {
        error = e;
      }

      createdError = log.createError(error);
      expect(createdError).not.to.equal(error);
      expect(createdError.message).to.equal(error.message);

      createdError = log.createError('should fail', 'XYZ', error);
      expect(createdError).not.to.equal(error);
      expect(createdError.message).to.contain('should fail XYZ:');
    });
  });

  describe('error', () => {
    it('throws an error', () => {
      expect(() => {
        log.error('Oof!');
      }).to.throw(/Oof!/)

      expect(() => {
        log.error(new Error('Oof!'));
      }).to.throw(/Oof!/)
    });
  });
});
