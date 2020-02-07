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
import {AnalyticsContext, AnalyticsRequest} from '../proto/api_messages';

describes.realWin('Types', {}, () => {
  describe('isEnumValue', () => {
    /** @enum {string} */
    const enumObj = {
      X: 'x',
      Y: 'y',
      Z: 'z',
    };

    it('should return true for valid enum values', () => {
      const values = ['x', 'y', 'z'];
      for (const value of values) {
        expect(types.isEnumValue(enumObj, value), 'enum value = ' + value).to.be
          .true;
      }
    });

    it('should return false for non-enum values', () => {
      const values = [
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
      ];
      for (const value of values) {
        expect(types.isEnumValue(enumObj, value), 'enum value = ' + value).to.be
          .false;
      }
    });
  });

  describe('isObject', () => {
    it('identifies objects', () => {
      const values = [{}, {x: 1}];
      for (const value of values) {
        expect(types.isObject(value)).to.be.true;
      }
    });

    it('identifies non-objects', () => {
      const values = [
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
      ];
      for (const value of values) {
        expect(types.isObject(value)).to.be.false;
      }
    });
  });

  describe('isFunction', () => {
    it('identifies functions', () => {
      const values = [function() {}, () => {}];
      for (const value of values) {
        expect(types.isFunction(value)).to.be.true;
      }
    });

    it('identifies non-functions', () => {
      const values = [
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
      ];
      for (const value of values) {
        expect(types.isFunction(value)).to.be.false;
      }
    });
  });

  describe('isBoolean', () => {
    it('identifies booleans', () => {
      const values = [true, false];
      for (const value of values) {
        expect(types.isBoolean(value)).to.be.true;
      }
    });

    it('identifies non-booleans', () => {
      const values = [
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
      ];
      for (const value of values) {
        expect(types.isBoolean(value)).to.be.false;
      }
    });
  });

  describe('isMessage', () => {
    it('identifies API messages', () => {
      expect(types.isMessage(new AnalyticsContext())).to.be.true;
      expect(types.isMessage(new AnalyticsRequest())).to.be.true;
    });

    it('identifies non API messages', () => {
      expect(types.isMessage({})).to.be.false;
      expect(types.isMessage(AnalyticsContext)).to.be.false;
    });
  });
});
