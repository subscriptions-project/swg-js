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

describes.realWin('Types', {}, env => {
  let win;

  beforeEach(() => {
    win = env.win;
  });

  describe('toArray', () => {

    it('should return empty array if null is passed', () => {
      expect(types.toArray(null).length).to.equal(0);
      expect(types.toArray(undefined).length).to.equal(0);
    });

    it('should convert NodeList to array', () => {
      const parent = win.document.createElement('div');
      parent.appendChild(win.document.createElement('p'));
      parent.appendChild(win.document.createElement('span'));
      parent.appendChild(win.document.createElement('div'));
      const arr = types.toArray(parent.childNodes);
      expect(arr[0]).to.equal(parent.childNodes[0]);
      expect(arr.length).to.equal(3);
      expect(Array.isArray(arr)).to.be.true;
    });

    it('should convert HTMLCollection to array', () => {
      const parent = win.document.createElement('div');
      parent.appendChild(win.document.createElement('form'));
      parent.appendChild(win.document.createElement('form'));
      win.document.body.appendChild(parent);
      const arr = types.toArray(win.document.forms);
      expect(arr[0]).to.equal(win.document.forms[0]);
      expect(arr.length).to.equal(2);
      expect(Array.isArray(arr)).to.be.true;
      win.document.body.removeChild(parent);
    });

    it('should convert HTMLOptionsCollection to array', () => {
      const parent = win.document.createElement('select');
      parent.appendChild(win.document.createElement('option'));
      parent.appendChild(win.document.createElement('option'));
      parent.appendChild(win.document.createElement('option'));
      parent.appendChild(win.document.createElement('option'));
      const arr = types.toArray(parent.options);
      expect(arr[0]).to.equal(parent.options[0]);
      expect(arr.length).to.equal(4);
      expect(Array.isArray(arr)).to.be.true;
    });
  });

  describe('isFiniteNumber', () => {

    it('should yield false for non-numbers', () => {
      expect(types.isFiniteNumber(null)).to.be.false;
      expect(types.isFiniteNumber(undefined)).to.be.false;
      expect(types.isFiniteNumber('')).to.be.false;
      expect(types.isFiniteNumber('2')).to.be.false;
      expect(types.isFiniteNumber([])).to.be.false;
      expect(types.isFiniteNumber([2])).to.be.false;
      expect(types.isFiniteNumber({})).to.be.false;
      expect(types.isFiniteNumber({'a': 2})).to.be.false;
      expect(types.isFiniteNumber(true)).to.be.false;
      expect(types.isFiniteNumber(NaN)).to.be.false;
    });

    it('should yield true for numbers', () => {
      expect(types.isFiniteNumber(3)).to.be.true;
      expect(types.isFiniteNumber(3.2)).to.be.true;
      expect(types.isFiniteNumber(123e5)).to.be.true;
    });
  });

  describe('isEnumValue', () => {
    /** @enum {string} */
    const enumObj = {
      X: 'x',
      Y: 'y',
      Z: 'z',
    };

    it('should return true for valid enum values', () => {
      ['x', 'y', 'z'].forEach(value => {
        expect(types.isEnumValue(enumObj, value),
            'enum value = ' + value).to.be.true;
      });
    });

    it('should return false for non-enum values', () => {
      ['a', 'X', 'Z', {'x': 'x'}, ['y'], null, undefined, [], /x/, /y/, 42]
          .forEach(value => {
            expect(types.isEnumValue(enumObj, value),
                'enum value = ' + value).to.be.false;
          });
    });
  });
});
