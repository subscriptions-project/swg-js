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
  isCancelError,
} from './errors';


describe('errors', () => {
  describe('isCancelError', () => {
    it('should return true for an abort error', () => {
      const e = new DOMException('cancel', 'AbortError');
      expect(isCancelError(e)).to.be.true;
    });

    it('should return false for non-errors', () => {
      expect(isCancelError(undefined)).to.be.false;
      expect(isCancelError(null)).to.be.false;
      expect(isCancelError('')).to.be.false;
      expect(isCancelError('abc')).to.be.false;
      expect(isCancelError(0)).to.be.false;
      expect(isCancelError(1)).to.be.false;
      expect(isCancelError(true)).to.be.false;
      expect(isCancelError(false)).to.be.false;
    });

    it('should return false for a unrelated error', () => {
      expect(isCancelError(new Error())).to.be.false;
    });
  });
});
