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

/**
 * Determines if value is actually an Object.
 */
export function isObject(value: unknown): boolean {
  const str = Object.prototype.toString.call(value);
  return str === '[object Object]';
}

/**
 * Checks whether `enumObj` has a given `value`.
 */
export function isEnumValue(enumObj: object, value: string | number): boolean {
  return Object.values(enumObj).includes(value);
}

/**
 * True if the value is a function.
 */
export function isFunction(value: unknown): boolean {
  return typeof value === 'function';
}

/**
 * True if the value is either true or false.
 */
export function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}
