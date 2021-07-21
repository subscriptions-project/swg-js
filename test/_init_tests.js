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

// This must load before all other tests.
import * as describes from '../test/describes';
import {CACHE_KEYS} from '../src/runtime/services';
import {PAY_ORIGIN} from '../src/runtime/pay-client';
import stringify from 'json-stable-stringify';

// All exposed describes.
global.describes = describes;

beforeEach(function () {
  this.timeout(5000);
  window.TEST = true;
  CACHE_KEYS['$frontendCache$'] = 0;
  PAY_ORIGIN['$payEnvironment$'] = 'PAY_ORIGIN';
});

// Global cleanup of tags added during tests. Cool to add more
// to selector.
afterEach(function () {
  this.timeout(5000);
  delete window.TEST;

  const forgotGlobal = !!global.sandbox;
  if (forgotGlobal) {
    // The error will be thrown later to give possibly other sandboxes a
    // chance to restore themselves.
    delete global.sandbox;
  }
  if (forgotGlobal) {
    throw new Error('You forgot to clear global sandbox!');
  }
  if (!/native/.test(window.setTimeout)) {
    throw new Error(
      'You likely forgot to restore sinon timers ' +
        '(installed via sandbox.useFakeTimers).'
    );
  }
});

chai.Assertion.addMethod('attribute', function (attr) {
  const obj = this._obj;
  const tagName = obj.tagName.toLowerCase();
  this.assert(
    obj.hasAttribute(attr),
    "expected element '" + tagName + "' to have attribute #{exp}",
    "expected element '" + tagName + "' to not have attribute #{act}",
    attr,
    attr
  );
});

chai.Assertion.addMethod('class', function (className) {
  const obj = this._obj;
  const tagName = obj.tagName.toLowerCase();
  this.assert(
    obj.classList.contains(className),
    "expected element '" + tagName + "' to have class #{exp}",
    "expected element '" + tagName + "' to not have class #{act}",
    className,
    className
  );
});

chai.Assertion.addProperty('visible', function () {
  const obj = this._obj;
  const computedStyle = window.getComputedStyle(obj);
  const visibility = computedStyle.getPropertyValue('visibility');
  const opacity = computedStyle.getPropertyValue('opacity');
  const isOpaque = parseInt(opacity, 10) > 0;
  const tagName = obj.tagName.toLowerCase();
  this.assert(
    visibility === 'visible' && isOpaque,
    "expected element '" +
      tagName +
      "' to be #{exp}, got #{act}. with classes: " +
      obj.className,
    "expected element '" +
      tagName +
      "' not to be #{exp}, got #{act}. with classes: " +
      obj.className,
    'visible and opaque',
    `visibility = ${visibility} and opacity = ${opacity}`
  );
});

chai.Assertion.addProperty('hidden', function () {
  const obj = this._obj;
  const computedStyle = window.getComputedStyle(obj);
  const visibility = computedStyle.getPropertyValue('visibility');
  const opacity = computedStyle.getPropertyValue('opacity');
  const tagName = obj.tagName.toLowerCase();
  this.assert(
    visibility === 'hidden' || parseInt(opacity, 10) == 0,
    "expected element '" +
      tagName +
      "' to be #{exp}, got #{act}. with classes: " +
      obj.className,
    "expected element '" +
      tagName +
      "' not to be #{act}. with classes: " +
      obj.className,
    'hidden',
    visibility
  );
});

chai.Assertion.addMethod('display', function (display) {
  const obj = this._obj;
  const value = window.getComputedStyle(obj).getPropertyValue('display');
  const tagName = obj.tagName.toLowerCase();
  this.assert(
    value === display,
    "expected element '" + tagName + "' to be #{exp}, got #{act}.",
    "expected element '" + tagName + "' not to be #{act}.",
    display,
    value
  );
});

chai.Assertion.addMethod('jsonEqual', function (compare) {
  const obj = this._obj;
  const a = stringify(compare);
  const b = stringify(obj);
  this.assert(
    a == b,
    'expected JSON to be equal.\nExp: #{exp}\nAct: #{act}',
    'expected JSON to not be equal.\nExp: #{exp}\nAct: #{act}',
    a,
    b
  );
});
