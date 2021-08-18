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

import {CACHE_KEYS, MODES, cacheParam, getSwgMode} from './services';

describes.sandboxed('services', {}, () => {
  beforeEach(() => {
    self.location.hash = '';
  });

  describe('runtime mode', () => {
    it('should return default values', () => {
      expect(getSwgMode()).to.deep.equal(MODES.default);
    });

    it('should overide with swg.mode=prod', () => {
      self.location.hash = 'swg.mode=prod';
      expect(getSwgMode()).to.deep.equal(MODES.prod);
    });

    it('should overide with swg.mode=qual', () => {
      self.location.hash = 'swg.mode=qual';
      expect(getSwgMode()).to.deep.equal(MODES.qual);
    });

    it('should overide with swg.mode=autopush', () => {
      self.location.hash = 'swg.mode=autopush';
      expect(getSwgMode()).to.deep.equal(MODES.autopush);
    });
  });

  describe('cache', () => {
    const now = 1520624744987;

    beforeEach(() => {
      sandbox.stub(Date, 'now').callsFake(() => now);
    });

    it('should only allow simple keys', () => {
      for (const k in CACHE_KEYS) {

        expect(k).to.match(/^[a-z]+[0-9]*$/);
      }
    });

    it('should resolve nocache', () => {
      expect(cacheParam('nocache')).to.equal('1520624744987');
    });

    it('should resolve hr1', () => {
      expect(cacheParam('hr1')).to.equal('422395');
    });

    it('should resolve hr12', () => {
      expect(cacheParam('hr12')).to.equal('35199');
    });

    it('should resolve zero', () => {
      expect(cacheParam('zero')).to.equal('_');
    });

    it('should resolve unknown value', () => {
      expect(cacheParam('unknown')).to.equal('1520624744987');
    });
  });
});
