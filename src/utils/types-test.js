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

import * as types from './types';

describes.realWin('Types', {}, () => {
  describe('isEnumValue', () => {
    /** @enum {string} */
    const enumObj = {
      X: 'x',
      Y: 'y',
      Z: 'z',
    };

    it('should return true for valid enum values', () => {
      ['x', 'y', 'z'].forEach(value => {
        expect(types.isEnumValue(enumObj, value), 'enum value = ' + value).to.be
          .true;
      });
    });

    it('should return false for non-enum values', () => {
      [
        '',
        'X',
        [],
        [1, 2, 3],
        {},
        {x: 1},
        /Hi/,
        0,
        1,
        true,
        false,
        function() {},
        () => {},
        null,
        undefined,
      ].forEach(value => {
        expect(types.isEnumValue(enumObj, value), 'enum value = ' + value).to.be
          .false;
      });
    });
  });

  describe('isObject', () => {
    it('identifies objects', () => {
      [{}, {x: 1}].forEach(value => {
        expect(types.isObject(value)).to.be.true;
      });
    });

    it('identifies non-objects', () => {
      [
        '',
        'X',
        [],
        [1, 2, 3],
        /Hi/,
        0,
        1,
        true,
        false,
        function() {},
        () => {},
        null,
        undefined,
      ].forEach(value => {
        expect(types.isObject(value)).to.be.false;
      });
    });
  });

  describe('isFunction', () => {
    it('identifies functions', () => {
      [function() {}, () => {}].forEach(value => {
        expect(types.isFunction(value)).to.be.true;
      });
    });

    it('identifies non-functions', () => {
      [
        '',
        'X',
        [],
        [1, 2, 3],
        {},
        {x: 1},
        /Hi/,
        0,
        1,
        true,
        false,
        null,
        undefined,
      ].forEach(value => {
        expect(types.isFunction(value)).to.be.false;
      });
    });
  });

  describe('isBoolean', () => {
    it('identifies booleans', () => {
      [true, false].forEach(value => {
        expect(types.isBoolean(value)).to.be.true;
      });
    });

    it('identifies non-booleans', () => {
      [
        '',
        'X',
        [],
        [1, 2, 3],
        {},
        {x: 1},
        /Hi/,
        0,
        1,
        function() {},
        () => {},
        null,
        undefined,
      ].forEach(value => {
        expect(types.isBoolean(value)).to.be.false;
      });
    });
  });
});
